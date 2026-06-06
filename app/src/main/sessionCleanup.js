/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { deleteMissionSessionCredentials } from './missionSessionCredentials.js'
import { getDataLayout } from './dataDirectoryManager.js'
import * as dockerManager from './dockerManager.js'
import {
  LIFECYCLE_EPHEMERAL,
  LIFECYCLE_PERSISTENT,
  LIFECYCLE_TEMPLATE,
  ROLE_DESKTOP,
  resourceLifecycle
} from './labResourceLabels.js'
import { clearDesktopRecoverySnapshot, listRecoverableDesktopSessionIds } from './desktopSetupRecovery.js'
import { deleteIncompleteLabSession } from './progressManager.js'
import { getAllSettings } from './settingsManager.js'
import { deleteSessionSshKeys } from './sshSessionManager.js'
import { DOCKER_RUNTIME_WSL_KVM, isWslDockerKvmRuntime } from './wsl/wslDockerKvm.js'
import { toDockerManagerRuntime } from './sessionDockerRuntime.js'
import { logger } from './utils/logger.js'
import { assertSafeSessionId } from './utils/sanitize.js'

/**
 * @param {string | null | undefined} runtime
 */
function runtimeRemovalKey(runtime) {
  return isWslDockerKvmRuntime(toDockerManagerRuntime(runtime)) ? DOCKER_RUNTIME_WSL_KVM : 'host'
}

/**
 * @param {string | null | undefined} resourceRuntime
 * @param {string | null | undefined} sessionRuntime
 * @param {Record<string, string> | undefined} labels
 * @returns {(string | null | undefined)[]}
 */
function removalRuntimeOrder(resourceRuntime, sessionRuntime, labels) {
  /** @type {(string | null | undefined)[]} */
  const order = []
  const add = (runtime) => {
    const key = runtimeRemovalKey(runtime)
    if (!order.some((row) => runtimeRemovalKey(row) === key)) {
      order.push(runtime ?? null)
    }
  }

  add(resourceRuntime)
  add(sessionRuntime)
  if (labels?.['sgq.role'] === ROLE_DESKTOP) {
    add(DOCKER_RUNTIME_WSL_KVM)
  }
  if (process.platform === 'win32') {
    add(DOCKER_RUNTIME_WSL_KVM)
  }
  add(null)
  return order
}

/**
 * @param {string} name
 * @param {Record<string, string> | undefined} labels
 * @param {string | null | undefined} dockerRuntime
 * @param {boolean} force
 * @param {string | null | undefined} [resourceRuntime]
 */
async function removeSgqContainer(name, labels, dockerRuntime, force, resourceRuntime = null) {
  /** @type {Error | null} */
  let lastError = null
  for (const runtime of removalRuntimeOrder(resourceRuntime, dockerRuntime, labels)) {
    const opts = dockerManager.dockerRuntimeOptions(toDockerManagerRuntime(runtime))
    try {
      await dockerManager.stopContainer(name, opts)
      await dockerManager.removeContainer(name, { ...opts, removeVolumes: true })
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }
  if (force) {
    await dockerManager.removeContainer(name, { removeVolumes: true })
    return
  }
  throw lastError ?? new Error(`Failed to remove container ${name}`)
}

/**
 * @param {string} name
 * @param {string | null | undefined} resourceRuntime
 * @param {string | null | undefined} sessionRuntime
 * @param {boolean} force
 * @returns {Promise<boolean>}
 */
async function removeSgqNetwork(name, resourceRuntime, sessionRuntime, force) {
  /** @type {Error | null} */
  let lastError = null
  for (const runtime of removalRuntimeOrder(resourceRuntime, sessionRuntime, undefined)) {
    try {
      const result = await dockerManager.removeNetwork(name, dockerManager.dockerRuntimeOptions(toDockerManagerRuntime(runtime)))
      if (result.removed) return true
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }
  if (force) {
    await dockerManager.removeNetwork(name, {})
    return true
  }
  if (lastError) throw lastError
  return false
}

/**
 * @param {string} name
 * @param {string | null | undefined} resourceRuntime
 * @param {string | null | undefined} sessionRuntime
 * @param {boolean} force
 * @returns {Promise<boolean>}
 */
async function removeSgqVolume(name, resourceRuntime, sessionRuntime, force) {
  /** @type {Error | null} */
  let lastError = null
  for (const runtime of removalRuntimeOrder(resourceRuntime, sessionRuntime, undefined)) {
    try {
      const result = await dockerManager.removeVolume(name, dockerManager.dockerRuntimeOptions(toDockerManagerRuntime(runtime)))
      if (result.removed) return true
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }
  if (force) {
    await dockerManager.removeVolume(name, {})
    return true
  }
  if (lastError) throw lastError
  return false
}

/**
 * @param {string} sessionId
 */
function cleanupSessionTempFiles(sessionId) {
  assertSafeSessionId(sessionId)
  let removed = 0
  const layout = getDataLayout()
  const cacheSessionDir = path.join(layout.cache, sessionId)
  if (fs.existsSync(cacheSessionDir)) {
    try {
      fs.rmSync(cacheSessionDir, { recursive: true, force: true })
      removed += 1
    } catch (error) {
      logger.warn('sessionCleanup', 'Failed to remove session cache dir', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  return removed
}

/**
 * @param {string} sessionId
 */
export async function collectSessionResources(sessionId) {
  assertSafeSessionId(sessionId)
  const [containers, networks, volumes, images] = await Promise.all([
    dockerManager.listSgqContainers({ sessionId, includeLegacy: true }),
    dockerManager.listSgqNetworks({ sessionId, includeLegacy: true }),
    dockerManager.listSgqVolumes({ sessionId }),
    dockerManager.listSgqImages({ sessionId, includeLegacy: true })
  ])
  return { containers, networks, volumes, images }
}

/**
 * @param {string} sessionId
 */
export async function verifySessionCleanup(sessionId) {
  const resources = await collectSessionResources(sessionId)
  /** @type {{ type: string, name: string, lifecycle?: string }[]} */
  const leftovers = []
  for (const container of resources.containers) {
    leftovers.push({ type: 'container', name: container.name, lifecycle: container.lifecycle })
  }
  for (const network of resources.networks) {
    leftovers.push({ type: 'network', name: network.name, lifecycle: network.lifecycle })
  }
  for (const volume of resources.volumes) {
    leftovers.push({ type: 'volume', name: volume.name, lifecycle: volume.lifecycle })
  }
  for (const image of resources.images) {
    leftovers.push({ type: 'image', name: image.reference, lifecycle: image.lifecycle })
  }
  return { clean: leftovers.length === 0, leftovers, resources }
}

/**
 * @param {object[]} leftovers
 * @param {object[]} errors
 */
function buildDeveloperDetails(leftovers, errors) {
  return {
    leftovers,
    errors,
    dockerCommands: [
      'docker ps -a --filter label=sgq.managed=true',
      'docker network ls --filter label=sgq.managed=true',
      'docker volume ls --filter label=sgq.managed=true',
      'docker images --filter label=sgq.managed=true'
    ]
  }
}

/**
 * @param {string} sessionId
 * @param {{
 *   labId?: string,
 *   sessionImage?: string,
 *   dockerRuntime?: string | null,
 *   force?: boolean,
 *   removeEphemeralImages?: boolean,
 *   removePersistentImages?: boolean,
 *   clearSessionState?: boolean
 * }} [options]
 */
export async function cleanupSessionResources(sessionId, options = {}) {
  assertSafeSessionId(sessionId)
  const force = options.force === true
  const clearSessionState = options.clearSessionState !== false
  const keepLabImagesCache = getAllSettings().keepLabImagesCache === true
  const removeEphemeralImages = options.removeEphemeralImages ?? true
  const removePersistentImages =
    options.removePersistentImages ?? (keepLabImagesCache !== true && options.removeEphemeralImages !== false)

  /** @type {{ type: string, name: string, message: string }[]} */
  const errors = []
  const removed = { containers: 0, networks: 0, volumes: 0, images: 0, tempFiles: 0 }

  const readiness = await dockerManager.checkReady()
  if (readiness.ready) {
    const containers = await dockerManager.listSgqContainers({ sessionId, includeLegacy: true })
    for (const container of containers) {
      try {
        await removeSgqContainer(
          container.name,
          container.labels,
          options.dockerRuntime,
          force,
          container.dockerRuntime ?? null
        )
        removed.containers += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push({ type: 'container', name: container.name, message })
        logger.warn('sessionCleanup', 'Container removal failed', { sessionId, name: container.name, message })
      }
    }

    const networks = await dockerManager.listSgqNetworks({ sessionId, includeLegacy: true })
    for (const network of networks) {
      try {
        if (await removeSgqNetwork(network.name, network.dockerRuntime ?? null, options.dockerRuntime ?? null, force)) {
          removed.networks += 1
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push({ type: 'network', name: network.name, message })
        logger.warn('sessionCleanup', 'Network removal failed', { sessionId, name: network.name, message })
      }
    }

    const volumes = await dockerManager.listSgqVolumes({ sessionId })
    for (const volume of volumes) {
      if (resourceLifecycle(volume.labels) !== LIFECYCLE_EPHEMERAL && !force) continue
      try {
        if (await removeSgqVolume(volume.name, volume.dockerRuntime ?? null, options.dockerRuntime ?? null, force)) {
          removed.volumes += 1
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push({ type: 'volume', name: volume.name, message })
      }
    }

    const images = await dockerManager.listSgqImages({ sessionId, includeLegacy: true })
    const imageCandidates = [...images]
    if (options.sessionImage && options.labId) {
      const alreadyListed = imageCandidates.some((row) => row.reference === options.sessionImage)
      if (!alreadyListed) {
        imageCandidates.push({
          reference: options.sessionImage,
          imageId: options.sessionImage,
          labels: {},
          lifecycle: LIFECYCLE_PERSISTENT,
          labId: options.labId
        })
      }
    }

    for (const image of imageCandidates) {
      const lifecycle = resourceLifecycle(image.labels)
      const shouldRemove =
        (removeEphemeralImages && lifecycle === LIFECYCLE_EPHEMERAL) ||
        (removePersistentImages && lifecycle === LIFECYCLE_PERSISTENT) ||
        (force && lifecycle !== LIFECYCLE_TEMPLATE)
      if (!shouldRemove) continue
      try {
        const labId = image.labId ?? options.labId ?? ''
        const result = await dockerManager.removeManagedLabImage(image.reference, labId, {
          dockerRuntime: image.dockerRuntime ?? null
        })
        if (result.removed) removed.images += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push({ type: 'image', name: image.reference, message })
      }
    }
  }

  if (clearSessionState) {
    deleteMissionSessionCredentials(sessionId)
    deleteSessionSshKeys(sessionId)
    deleteIncompleteLabSession(sessionId)
    clearDesktopRecoverySnapshot(sessionId)
    removed.tempFiles += cleanupSessionTempFiles(sessionId)
  }

  const verify = await verifySessionCleanup(sessionId)
  const ok = verify.clean && errors.length === 0

  if (removed.containers + removed.networks + removed.volumes + removed.images + removed.tempFiles > 0) {
    logger.info('sessionCleanup', 'Session resources cleaned', { sessionId, removed, ok })
  }

  return {
    ok,
    verified: verify.clean,
    removed,
    leftovers: verify.leftovers,
    errors,
    developerDetails: buildDeveloperDetails(verify.leftovers, errors)
  }
}

/**
 * @param {() => string[]} getActiveSessionIds
 * @param {{ includeRecoverableDesktop?: boolean }} [options]
 */
export async function scanStaleSgqResources(getActiveSessionIds, options = {}) {
  const active = new Set(getActiveSessionIds())
  const includeRecoverableDesktop = options.includeRecoverableDesktop === true
  const recoverable = includeRecoverableDesktop
    ? new Set()
    : new Set(await listRecoverableDesktopSessionIds())
  const readiness = await dockerManager.checkReady()
  if (!readiness.ready) {
    return { found: false, summary: { containers: 0, networks: 0, volumes: 0, images: 0 }, resources: [] }
  }

  const isEphemeral = (labels) => {
    const lifecycle = resourceLifecycle(labels)
    return lifecycle === LIFECYCLE_EPHEMERAL
  }

  const [containers, networks, volumes, images] = await Promise.all([
    dockerManager.listSgqContainers({ includeLegacy: true }),
    dockerManager.listSgqNetworks({ includeLegacy: true }),
    dockerManager.listSgqVolumes({}),
    dockerManager.listSgqImages({ includeLegacy: true })
  ])

  /** @type {object[]} */
  const resources = []
  for (const container of containers) {
    if (!isEphemeral(container.labels)) continue
    const sessionId = container.sessionId
    if (sessionId && active.has(sessionId)) continue
    if (sessionId && recoverable.has(sessionId)) continue
    resources.push({ type: 'container', name: container.name, sessionId, lifecycle: container.lifecycle })
  }
  for (const network of networks) {
    if (!isEphemeral(network.labels)) continue
    const sessionId = network.sessionId
    if (sessionId && active.has(sessionId)) continue
    if (sessionId && recoverable.has(sessionId)) continue
    resources.push({ type: 'network', name: network.name, sessionId, lifecycle: network.lifecycle })
  }
  for (const volume of volumes) {
    if (!isEphemeral(volume.labels)) continue
    const sessionId = volume.sessionId
    if (sessionId && active.has(sessionId)) continue
    if (sessionId && recoverable.has(sessionId)) continue
    resources.push({ type: 'volume', name: volume.name, sessionId, lifecycle: volume.lifecycle })
  }
  for (const image of images) {
    if (!isEphemeral(image.labels)) continue
    const sessionId = image.sessionId
    if (sessionId && active.has(sessionId)) continue
    if (sessionId && recoverable.has(sessionId)) continue
    resources.push({ type: 'image', name: image.reference, sessionId, lifecycle: image.lifecycle })
  }

  const summary = {
    containers: resources.filter((row) => row.type === 'container').length,
    networks: resources.filter((row) => row.type === 'network').length,
    volumes: resources.filter((row) => row.type === 'volume').length,
    images: resources.filter((row) => row.type === 'image').length
  }

  return {
    found: resources.length > 0,
    summary,
    resources
  }
}

/**
 * @param {{ removeImagesWhenCacheDisabled?: boolean, getActiveSessionIds?: () => string[], includeRecoverableDesktop?: boolean }} [options]
 */
export async function cleanupEphemeralManagedResources(options = {}) {
  const keepLabImagesCache = getAllSettings().keepLabImagesCache === true
  const removeImages = options.removeImagesWhenCacheDisabled !== false && !keepLabImagesCache
  const getActiveSessionIds = options.getActiveSessionIds ?? (() => [])

  const scan = await scanStaleSgqResources(getActiveSessionIds, {
    includeRecoverableDesktop: options.includeRecoverableDesktop === true
  })
  /** @type {Set<string>} */
  const sessionIds = new Set()
  for (const resource of scan.resources) {
    if (resource.sessionId) sessionIds.add(resource.sessionId)
  }

  const aggregate = { containers: 0, networks: 0, volumes: 0, images: 0, sessions: 0, errors: [] }
  for (const sessionId of sessionIds) {
    const result = await cleanupSessionResources(sessionId, {
      removeEphemeralImages: true,
      removePersistentImages: removeImages,
      clearSessionState: true,
      force: options.includeRecoverableDesktop === true
    })
    aggregate.containers += result.removed.containers
    aggregate.networks += result.removed.networks
    aggregate.volumes += result.removed.volumes
    aggregate.images += result.removed.images
    aggregate.sessions += 1
    if (result.errors.length) aggregate.errors.push(...result.errors)
  }

  // Orphan SGQ resources without session id (legacy crash leftovers).
  const readiness = await dockerManager.checkReady()
  if (readiness.ready) {
    const orphanContainers = (await dockerManager.listSgqContainers({ includeLegacy: true })).filter(
      (row) => !row.sessionId && resourceLifecycle(row.labels) === LIFECYCLE_EPHEMERAL
    )
    for (const container of orphanContainers) {
      try {
        await removeSgqContainer(
          container.name,
          container.labels,
          null,
          false,
          container.dockerRuntime ?? null
        )
        aggregate.containers += 1
      } catch (error) {
        aggregate.errors.push({
          type: 'container',
          name: container.name,
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }

    const orphanNetworks = (await dockerManager.listSgqNetworks({ includeLegacy: true })).filter(
      (row) => !row.sessionId && resourceLifecycle(row.labels) === LIFECYCLE_EPHEMERAL
    )
    for (const network of orphanNetworks) {
      try {
        if (await removeSgqNetwork(network.name, network.dockerRuntime ?? null, null, false)) {
          aggregate.networks += 1
        }
      } catch (error) {
        aggregate.errors.push({
          type: 'network',
          name: network.name,
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  return aggregate
}

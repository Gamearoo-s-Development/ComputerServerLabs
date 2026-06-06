/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as dockerManager from './dockerManager.js'
import { deleteAllSessionCredentials } from './credentialManager.js'
import { LIFECYCLE_EPHEMERAL, LIFECYCLE_TEMPLATE, resourceLifecycle } from './labResourceLabels.js'
import { purgeIncompleteLabSessions } from './progressManager.js'
import { cleanupEphemeralManagedResources, scanStaleSgqResources } from './sessionCleanup.js'
import { deleteAllSessionSshKeys } from './sshSessionManager.js'
import { getAllSettings } from './settingsManager.js'
import { logger } from './utils/logger.js'

/** @type {Awaited<ReturnType<typeof scanStaleSgqResources>> | null} */
let pendingStaleResourceScan = null

/** @type {(() => string[]) | null} */
let activeSessionIdsProvider = null

/**
 * @param {() => string[]} provider
 */
export function registerActiveSessionIdsProvider(provider) {
  activeSessionIdsProvider = provider
}

function getActiveSessionIds() {
  return activeSessionIdsProvider?.() ?? []
}

/**
 * Scan for stale ephemeral SGQ resources without deleting them.
 */
export async function scanStaleManagedLabResources() {
  const scan = await scanStaleSgqResources(getActiveSessionIds)
  pendingStaleResourceScan = scan
  return scan
}

/**
 * @deprecated Startup no longer auto-deletes — use scanStaleManagedLabResources + user prompt.
 */
export async function cleanupStaleManagedLabResources() {
  return scanStaleManagedLabResources()
}

export function consumePendingStaleResourceScan() {
  const scan = pendingStaleResourceScan
  pendingStaleResourceScan = null
  return scan
}

/**
 * Stop/remove ephemeral SGQ-managed Docker resources on app quit.
 * Persistent/template resources are kept unless cache removal is enabled.
 *
 * @param {{ removeImagesWhenCacheDisabled?: boolean, ephemeralOnly?: boolean, includeRecoverableDesktop?: boolean }} [options]
 */
export async function cleanupAllManagedResources(options = {}) {
  const ephemeralOnly = options.ephemeralOnly !== false
  if (ephemeralOnly) {
    return cleanupEphemeralManagedResources({
      removeImagesWhenCacheDisabled: options.removeImagesWhenCacheDisabled,
      getActiveSessionIds,
      includeRecoverableDesktop: options.includeRecoverableDesktop === true
    })
  }

  const keepLabImagesCache = getAllSettings().keepLabImagesCache === true
  let containersRemoved = 0
  let imagesRemoved = 0
  let networksRemoved = 0

  const readiness = await dockerManager.checkReady()
  if (readiness.ready) {
    const containers = await dockerManager.listSgqContainers({ includeLegacy: true })
    for (const container of containers) {
      if (resourceLifecycle(container.labels) === LIFECYCLE_TEMPLATE) continue
      try {
        const dockerOpts = dockerManager.dockerRuntimeOptions(container.dockerRuntime ?? null)
        await dockerManager.stopContainer(container.name, dockerOpts)
        await dockerManager.removeContainer(container.name, { ...dockerOpts, removeVolumes: true })
        containersRemoved += 1
      } catch (error) {
        logger.warn('labCleanup', 'Failed to remove managed container', {
          name: container.name,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    try {
      const networks = await dockerManager.listSgqNetworks({ includeLegacy: true })
      for (const net of networks) {
        if (resourceLifecycle(net.labels) === LIFECYCLE_TEMPLATE) continue
        try {
          const removed = await dockerManager.removeNetwork(
            net.name,
            dockerManager.dockerRuntimeOptions(net.dockerRuntime ?? null)
          )
          if (removed.removed) networksRemoved += 1
        } catch (error) {
          logger.warn('labCleanup', 'Failed to remove managed network', {
            name: net.name,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    } catch (error) {
      logger.warn('labCleanup', 'Failed to list managed networks', {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    const removeImages = options.removeImagesWhenCacheDisabled !== false && !keepLabImagesCache
    if (removeImages) {
      const images = await dockerManager.listSgqImages({ includeLegacy: true })
      for (const image of images) {
        if (resourceLifecycle(image.labels) === LIFECYCLE_TEMPLATE) continue
        try {
          const removed = await dockerManager.removeManagedLabImage(image.reference, image.labId ?? '', {
            dockerRuntime: image.dockerRuntime ?? null
          })
          if (removed.removed) imagesRemoved += 1
        } catch (error) {
          logger.warn('labCleanup', 'Failed to remove managed image', {
            reference: image.reference,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }
  }

  const sessionsRemoved = deleteAllSessionCredentials()
  const sshKeysRemoved = deleteAllSessionSshKeys()
  const dbSessionsPurged = purgeIncompleteLabSessions()

  if (
    containersRemoved > 0 ||
    imagesRemoved > 0 ||
    networksRemoved > 0 ||
    sessionsRemoved > 0 ||
    sshKeysRemoved > 0 ||
    dbSessionsPurged > 0
  ) {
    logger.info('labCleanup', 'Cleaned up managed lab resources', {
      containersRemoved,
      imagesRemoved,
      networksRemoved,
      sessionsRemoved,
      sshKeysRemoved,
      dbSessionsPurged
    })
  }

  return { containersRemoved, imagesRemoved, networksRemoved, sessionsRemoved, dbSessionsPurged }
}

/**
 * User chose "Clean Up Now" from startup recovery prompt.
 */
export async function cleanupStaleResourcesNow() {
  const result = await cleanupEphemeralManagedResources({
    removeImagesWhenCacheDisabled: true,
    getActiveSessionIds
  })
  pendingStaleResourceScan = null
  return result
}

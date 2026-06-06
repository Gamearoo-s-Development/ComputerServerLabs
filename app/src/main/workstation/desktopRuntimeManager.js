/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import * as dockerManager from '../dockerManager.js'
import { classifyDockerImageTrust } from '../dockerImageTrust.js'
import { getUserDataFile } from '../utils/paths.js'
import { detectWorkstationCapabilities } from './workstationCapabilities.js'
import { isDesktopKvmAvailable } from './workstationDesktopDiagnostics.js'
import {
  DESKTOP_RUNTIME_KEYS,
  DESKTOP_RUNTIME_PRESETS,
  DESKTOP_RUNTIME_RESOURCE_HINTS
} from './desktopRuntimePresets.js'
import {
  buildDesktopContainerPortSpecs,
  clearDesktopFileDefaultsCache,
  loadRawDesktopFileDefaults
} from './desktopRuntimeDefaults.js'
import { assertDesktopKvmForProvision } from './workstationDesktopDiagnostics.js'
import { isWslDockerKvmRuntime } from '../wsl/wslDockerKvm.js'
import { inspectWorkstationAccessRoutes } from './workstationAccessRoutes.js'

export const DESKTOP_RUNTIME_STATUS = {
  AVAILABLE: 'available',
  NEEDS_IMAGE: 'needs_image',
  UNAVAILABLE: 'unavailable'
}

const USER_CONFIG_FILE = 'desktop-runtime.json'

/** @type {Record<string, object> | null} */
let cachedUserConfig = null

function getUserConfigPath() {
  return getUserDataFile(USER_CONFIG_FILE)
}

function loadUserConfig() {
  if (cachedUserConfig) return cachedUserConfig
  try {
    const raw = JSON.parse(fs.readFileSync(getUserConfigPath(), 'utf8'))
    cachedUserConfig = raw?.runtimes && typeof raw.runtimes === 'object' ? raw.runtimes : {}
  } catch {
    cachedUserConfig = {}
  }
  return cachedUserConfig
}

function persistUserConfig(runtimes) {
  cachedUserConfig = runtimes
  const configPath = getUserConfigPath()
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify({ version: 1, runtimes }, null, 2), 'utf8')
  clearDesktopFileDefaultsCache()
}

export function clearDesktopRuntimeUserCache() {
  cachedUserConfig = null
  clearDesktopFileDefaultsCache()
}

export function clearDesktopConfigCache() {
  clearDesktopFileDefaultsCache()
}

/**
 * @param {unknown} entry
 * @param {string} key
 */
function normalizeFileRuntimeEntry(entry, key) {
  const e = entry && typeof entry === 'object' ? /** @type {Record<string, unknown>} */ (entry) : {}
  const webViewerPort =
    typeof e.webViewerPort === 'number' && e.webViewerPort > 0 ? e.webViewerPort : 8006
  const accessPorts = Array.isArray(e.accessPorts)
    ? e.accessPorts.map((p) => Number(p)).filter((p) => Number.isFinite(p) && p > 0)
    : key === 'windows'
      ? [8006, 3389, 5900]
      : [8006, 5900]

  return {
    key,
    id: typeof e.id === 'string' ? e.id.trim() : '',
    name: typeof e.name === 'string' ? e.name.trim() : '',
    provider: typeof e.provider === 'string' ? e.provider.trim() : '',
    osFamily: e.osFamily === 'windows' ? 'windows' : 'linux',
    image: typeof e.image === 'string' ? e.image.trim() : '',
    enabled: e.enabled !== false,
    trusted: e.trusted === true,
    webViewerPort,
    accessPorts,
    defaultVersion: typeof e.defaultVersion === 'string' ? e.defaultVersion.trim() : null,
    environment:
      e.environment && typeof e.environment === 'object' && !Array.isArray(e.environment)
        ? /** @type {Record<string, string>} */ (e.environment)
        : {}
  }
}

/**
 * @param {string} key
 */
function getFileRuntimeDefaults(key) {
  const raw = loadRawDesktopFileDefaults()
  const entry = raw.desktopWorkstations?.[key]
  return normalizeFileRuntimeEntry(entry, key)
}

/**
 * @param {string} key
 */
function mergeRuntimeEntry(key) {
  const fileDefaults = getFileRuntimeDefaults(key)
  const user = loadUserConfig()[key] ?? {}

  const image =
    typeof user.image === 'string' && user.image.trim()
      ? user.image.trim()
      : fileDefaults.image

  return {
    ...fileDefaults,
    image,
    enabled: user.enabled !== undefined ? user.enabled === true : fileDefaults.enabled,
    trusted: user.trusted === true,
    registrySource:
      typeof user.registrySource === 'string' && user.registrySource.trim()
        ? user.registrySource.trim()
        : null,
    pullStatus: user.pullStatus ?? null,
    lastTest: user.lastTest ?? null,
    lastTestedAt: user.lastTestedAt ?? user.lastTest?.at ?? null
  }
}

/**
 * @param {object} runtime
 * @param {object} caps
 */
export function computeDesktopRuntimeStatus(runtime, caps) {
  if (!caps?.dockerReady) {
    return { status: DESKTOP_RUNTIME_STATUS.UNAVAILABLE, reason: 'Docker is not available.' }
  }
  if (!isDesktopKvmAvailable(caps)) {
    return {
      status: DESKTOP_RUNTIME_STATUS.UNAVAILABLE,
      reason: caps.dockerKvm?.reason ?? 'KVM/nested virtualization is not available.'
    }
  }
  if (runtime.enabled === false) {
    return { status: DESKTOP_RUNTIME_STATUS.NEEDS_IMAGE, reason: 'Runtime disabled.' }
  }
  if (!runtime.image?.trim()) {
    return { status: DESKTOP_RUNTIME_STATUS.NEEDS_IMAGE, reason: 'Not configured.' }
  }
  if (runtime.lastTest?.ok === false) {
    return {
      status: DESKTOP_RUNTIME_STATUS.UNAVAILABLE,
      reason: runtime.lastTest.message ?? 'Last validation failed.'
    }
  }
  if (runtime.lastTest?.ok === true) {
    return { status: DESKTOP_RUNTIME_STATUS.AVAILABLE, reason: null }
  }
  return {
    status: DESKTOP_RUNTIME_STATUS.NEEDS_IMAGE,
    reason: 'Image configured — run Test Desktop Runtime to verify.'
  }
}

/**
 * @param {object} runtime
 */
function enrichRuntimeForClient(runtime) {
  const trust = classifyDockerImageTrust(runtime.image ?? '')
  const presets = DESKTOP_RUNTIME_PRESETS[runtime.key] ?? []
  return {
    ...runtime,
    presets,
    resourceHint: DESKTOP_RUNTIME_RESOURCE_HINTS[runtime.key] ?? null,
    trustLevel: runtime.trusted ? 'user-trusted' : trust.badge,
    trustLabel: runtime.trusted ? 'Trusted by you' : trust.badgeLabel,
    imageSource: runtime.registrySource ?? trust.registry,
    publisher: trust.publisher,
    requiredPorts: runtime.accessPorts ?? [],
    accessModes: runtime.osFamily === 'windows' ? ['Browser Desktop', 'RDP', 'VNC'] : ['Browser Desktop', 'VNC']
  }
}

/**
 * @param {object} [options]
 */
export async function listDesktopRuntimes(options = {}) {
  const caps = options.capabilities ?? (await detectWorkstationCapabilities())
  const runtimes = DESKTOP_RUNTIME_KEYS.map((key) => {
    const runtime = mergeRuntimeEntry(key)
    const status = computeDesktopRuntimeStatus(runtime, caps)
    return enrichRuntimeForClient({
      ...runtime,
      status: status.status,
      statusReason: status.reason
    })
  })
  return { runtimes, capabilities: caps }
}

/**
 * @param {string} profileOrProviderId
 */
export function getDesktopRuntimeByProfileId(profileOrProviderId) {
  const id = profileOrProviderId?.trim()
  if (!id) return null
  for (const key of DESKTOP_RUNTIME_KEYS) {
    const runtime = mergeRuntimeEntry(key)
    if (runtime.id === id || runtime.provider === id) {
      return runtime
    }
  }
  return null
}

/**
 * @param {string} key
 * @param {object} patch
 */
export function saveDesktopRuntime(key, patch) {
  if (!DESKTOP_RUNTIME_KEYS.includes(key)) {
    throw new Error(`Unknown desktop runtime: ${key}`)
  }
  const runtimes = { ...loadUserConfig() }
  const prev = runtimes[key] ?? {}
  const next = { ...prev }

  if (typeof patch.image === 'string') {
    next.image = patch.image.trim()
    next.lastTest = null
    next.lastTestedAt = null
  }
  if (patch.enabled !== undefined) next.enabled = patch.enabled === true
  if (patch.trusted !== undefined) next.trusted = patch.trusted === true
  if (typeof patch.registrySource === 'string') next.registrySource = patch.registrySource.trim()

  runtimes[key] = next
  persistUserConfig(runtimes)
  return mergeRuntimeEntry(key)
}

/**
 * @param {string} image
 * @param {{ dockerRuntime?: string | null }} [options]
 */
export async function pullDesktopRuntimeImage(image, options = {}) {
  const dockerOpts = isWslDockerKvmRuntime(options.dockerRuntime)
    ? { runtime: options.dockerRuntime }
    : {}
  const exists = await dockerManager.imageExists(image, dockerOpts)
  if (exists) {
    return { ok: true, pulled: false, message: 'Image already present locally.' }
  }
  await dockerManager.pullImage(image, dockerOpts)
  return { ok: true, pulled: true, message: 'Image pulled successfully.' }
}

/**
 * @param {string} key
 * @param {{ image?: string, pullOnly?: boolean }} [options]
 */
export async function testDesktopRuntime(key, options = {}) {
  if (!DESKTOP_RUNTIME_KEYS.includes(key)) {
    throw new Error(`Unknown desktop runtime: ${key}`)
  }

  const runtime = mergeRuntimeEntry(key)
  const image = (options.image ?? runtime.image)?.trim()
  if (!image) {
    throw new Error('No image configured for this desktop runtime.')
  }

  const caps = await detectWorkstationCapabilities({ refresh: true })
  if (!caps.dockerReady) {
    throw new Error('Docker is not available.')
  }

  let dockerRuntime = null
  try {
    const kvm = await assertDesktopKvmForProvision()
    dockerRuntime = kvm.dockerRuntime ?? null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failRecord = {
      ok: false,
      at: new Date().toISOString(),
      message,
      stage: 'kvm'
    }
    persistRuntimeTest(key, { pullStatus: null, lastTest: failRecord })
    return { ok: false, runtime: mergeRuntimeEntry(key), ...failRecord }
  }

  const dockerOpts = isWslDockerKvmRuntime(dockerRuntime) ? { runtime: dockerRuntime } : {}

  let pullStatus
  try {
    pullStatus = await pullDesktopRuntimeImage(image, { dockerRuntime })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failRecord = {
      ok: false,
      at: new Date().toISOString(),
      message: `Pull failed: ${message}`,
      stage: 'pull'
    }
    persistRuntimeTest(key, { pullStatus: { ok: false, message }, lastTest: failRecord })
    return { ok: false, runtime: mergeRuntimeEntry(key), ...failRecord }
  }

  if (options.pullOnly === true) {
    persistRuntimeTest(key, { pullStatus, image })
    if (options.image) saveDesktopRuntime(key, { image: options.image })
    return { ok: true, pullOnly: true, pullStatus, runtime: mergeRuntimeEntry(key) }
  }

  const containerName = `sgq-desktop-test-${key}-${Date.now()}`
  const portSpecs = buildDesktopContainerPortSpecs(runtime.accessPorts, runtime.webViewerPort)
  /** @type {Record<string, string>} */
  const env = { ...(runtime.environment ?? {}) }
  if (runtime.osFamily === 'windows' && runtime.defaultVersion) {
    env.VERSION = runtime.defaultVersion
  }

  let containerId = null
  try {
    const runResult = await dockerManager.runContainer({
      name: containerName,
      image,
      labId: 'desktop-runtime-test',
      sessionId: `test-${key}`,
      resourceRole: dockerManager.ROLE_DESKTOP,
      lifecycle: dockerManager.LIFECYCLE_EPHEMERAL,
      ports: portSpecs,
      portOptions: { bindAddress: '127.0.0.1' },
      env,
      runProfile: 'desktop-vm',
      privileged: true,
      devices: ['/dev/kvm', '/dev/net/tun'],
      capAdd: ['NET_ADMIN'],
      timeoutMs: 180_000,
      dockerRuntime
    })
    containerId = runResult.containerId

    const wait = await dockerManager.waitForContainerRunning(containerId, {
      timeoutMs: 90_000,
      pollMs: 1000,
      logLabel: 'desktop-runtime-test',
      dockerRuntime
    })

    const accessRoutes = await inspectWorkstationAccessRoutes(containerId, {
      dockerRuntime,
      webViewerPort: runtime.webViewerPort
    })

    const hasViewer =
      accessRoutes.some((r) => r.type === 'novnc') ||
      accessRoutes.some((r) => r.type === 'vnc') ||
      accessRoutes.some((r) => r.type === 'rdp')

    const successRecord = {
      ok: wait.running && hasViewer,
      at: new Date().toISOString(),
      message: wait.running
        ? hasViewer
          ? 'Desktop runtime test passed — viewer ports detected.'
          : 'Container started but no web/VNC/RDP viewer ports were detected.'
        : `Container did not stay running (${wait.status ?? 'unknown'}).`,
      stage: 'start',
      accessRoutes,
      containerStatus: wait.status ?? null
    }

    if (options.image) {
      saveDesktopRuntime(key, { image: options.image })
    }
    persistRuntimeTest(key, {
      pullStatus,
      lastTest: successRecord,
      image: options.image ?? image
    })

    return { ok: successRecord.ok, runtime: mergeRuntimeEntry(key), pullStatus, ...successRecord }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failRecord = {
      ok: false,
      at: new Date().toISOString(),
      message,
      stage: 'start'
    }
    persistRuntimeTest(key, { pullStatus, lastTest: failRecord, image: options.image ?? image })
    return { ok: false, runtime: mergeRuntimeEntry(key), pullStatus, ...failRecord }
  } finally {
    if (containerId) {
      await dockerManager.stopContainer(containerId, dockerOpts).catch(() => {})
      await dockerManager.removeContainer(containerId, dockerOpts).catch(() => {})
    } else {
      await dockerManager.removeContainer(containerName, dockerOpts).catch(() => {})
    }
  }
}

/**
 * @param {string} key
 * @param {object} patch
 */
function persistRuntimeTest(key, patch) {
  const runtimes = { ...loadUserConfig() }
  const prev = runtimes[key] ?? {}
  runtimes[key] = {
    ...prev,
    ...(patch.image ? { image: patch.image } : {}),
    ...(patch.pullStatus ? { pullStatus: patch.pullStatus } : {}),
    ...(patch.lastTest
      ? { lastTest: patch.lastTest, lastTestedAt: patch.lastTest.at ?? new Date().toISOString() }
      : {})
  }
  persistUserConfig(runtimes)
}

/**
 * @param {string} profileId
 * @param {object} [caps]
 */
export async function getDesktopRuntimeStatusForProfile(profileId, caps) {
  const runtime = getDesktopRuntimeByProfileId(profileId)
  if (!runtime) return null
  const capabilities = caps ?? (await detectWorkstationCapabilities())
  return computeDesktopRuntimeStatus(runtime, capabilities)
}

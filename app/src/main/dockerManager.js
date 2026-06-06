/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import net from 'net'
import path from 'path'
import { detectDocker, isDockerReady, resolveDockerCommand } from './toolDetection.js'
import {
  DOCKER_RUNTIME_WSL_KVM,
  isWslDockerKvmRuntime,
  runWslDockerCommand
} from './wsl/wslDockerKvm.js'
import { runCommand } from './utils/exec.js'
import { getConfigPath } from './utils/paths.js'
import { logger } from './utils/logger.js'
import {
  SGQ_LAB,
  SGQ_LIFECYCLE,
  SGQ_MANAGED,
  SGQ_ROLE,
  SGQ_SESSION,
  LEGACY_LAB_ID_LABEL,
  LEGACY_MANAGED_LABEL,
  LEGACY_SESSION_ID_LABEL,
  buildSgqLabels,
  dockerLabelArgs,
  isSgqManagedResource,
  LIFECYCLE_EPHEMERAL,
  LIFECYCLE_PERSISTENT,
  resourceLifecycle,
  resourceSessionId
} from './labResourceLabels.js'

const BUILD_TIMEOUT_MS = 600_000
const PULL_TIMEOUT_MS = 600_000
const RUN_TIMEOUT_MS = 120_000
const DEFAULT_TIMEOUT_MS = 60_000

export const MANAGED_LABEL = LEGACY_MANAGED_LABEL
export const LAB_ID_LABEL = LEGACY_LAB_ID_LABEL
export const SESSION_ID_LABEL = LEGACY_SESSION_ID_LABEL

export {
  SGQ_MANAGED,
  SGQ_SESSION,
  SGQ_LAB,
  SGQ_ROLE,
  SGQ_LIFECYCLE,
  LIFECYCLE_EPHEMERAL,
  LIFECYCLE_PERSISTENT,
  ROLE_TARGET,
  ROLE_WORKSTATION,
  ROLE_DESKTOP,
  ROLE_SERVICE
} from './labResourceLabels.js'

export { DOCKER_RUNTIME_WSL_KVM } from './wsl/wslDockerKvm.js'

/** @type {string | null} */
let cachedDockerBin = null

/** @type {{ memory: string, memorySwap: string, cpus: string, pidsLimit: number } | null} */
let cachedRunLimits = null

function getDockerRunLimits() {
  if (cachedRunLimits) return cachedRunLimits
  const fallback = { memory: '768m', memorySwap: '768m', cpus: '2', pidsLimit: 256 }
  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath('app.defaults.json'), 'utf8'))
    const limits = config.docker?.limits ?? {}
    cachedRunLimits = {
      memory: typeof limits.memory === 'string' ? limits.memory : fallback.memory,
      memorySwap: typeof limits.memorySwap === 'string' ? limits.memorySwap : fallback.memorySwap,
      cpus: typeof limits.cpus === 'string' ? String(limits.cpus) : fallback.cpus,
      pidsLimit:
        typeof limits.pidsLimit === 'number' && limits.pidsLimit > 0 ? limits.pidsLimit : fallback.pidsLimit
    }
  } catch {
    cachedRunLimits = fallback
  }
  return cachedRunLimits
}

/**
 * Apply cgroup / capability guardrails to managed lab containers.
 * @param {string[]} args
 * @param {'lab-hardened' | 'lab-ssh-target'} [profile]
 */
function appendContainerHardeningFlags(args, profile = 'lab-hardened') {
  const limits = getDockerRunLimits()
  args.push('--memory', limits.memory)
  args.push('--memory-swap', limits.memorySwap)
  args.push('--cpus', limits.cpus)
  args.push('--pids-limit', String(limits.pidsLimit))
  // Do not set no-new-privileges — it blocks setuid sudo inside training labs (ufw, systemctl, etc.).
  // Isolation still comes from cap-drop, no privileged mode, and session bridge networks.
  args.push('--cap-drop', 'ALL')
  // NET_ADMIN / NET_RAW: ufw, iptables, routing inside the container netns (not the host).
  const baseCaps = [
    'CHOWN',
    'DAC_OVERRIDE',
    'SETGID',
    'SETUID',
    'NET_BIND_SERVICE',
    'NET_ADMIN',
    'NET_RAW'
  ]
  // SYS_CHROOT: OpenSSH pre-auth sandbox; AUDIT_WRITE: interactive PTY sessions audit login events.
  const caps =
    profile === 'lab-ssh-target' ? [...baseCaps, 'SYS_CHROOT', 'AUDIT_WRITE'] : baseCaps
  for (const cap of caps) {
    args.push('--cap-add', cap)
  }
}

/**
 * @returns {Promise<string | null>}
 */
async function getDockerBin() {
  if (cachedDockerBin) return cachedDockerBin
  cachedDockerBin = await resolveDockerCommand()
  return cachedDockerBin
}

/**
 * @param {string[]} args
 * @param {{ timeout?: number, cwd?: string, runtime?: string, dockerRuntime?: string }} [options]
 */
async function docker(args, options = {}) {
  const runtime = options.dockerRuntime ?? options.runtime
  if (isWslDockerKvmRuntime(runtime)) {
    return runWslDockerCommand(args, {
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      distro: options.distro ?? null,
      cwd: options.cwd
    })
  }

  const dockerBin = await getDockerBin()
  if (!dockerBin) {
    return {
      ok: false,
      stdout: '',
      stderr: 'Docker CLI not found',
      code: 1
    }
  }
  const result = await runCommand(dockerBin, args, {
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    cwd: options.cwd
  })
  return result
}

/** @type {(string | null)[] | null} */
let cachedInventoryRuntimes = null
/** @type {number} */
let cachedInventoryRuntimesAt = 0

/**
 * Docker CLI contexts to scan for SGQ resources (host + WSL on Windows).
 * @param {{ bypassCache?: boolean }} [options]
 * @returns {Promise<(string | null)[]>}
 */
async function resolveSgqInventoryRuntimes(options = {}) {
  const now = Date.now()
  if (!options.bypassCache && cachedInventoryRuntimes && now - cachedInventoryRuntimesAt < 30_000) {
    return cachedInventoryRuntimes
  }

  /** @type {(string | null)[]} */
  const runtimes = [null]
  if (process.platform === 'win32') {
    // Always probe WSL during inventory — desktop labs may run only on WSL Docker even when
    // host Docker Desktop also shows the same engine in the UI.
    runtimes.push(DOCKER_RUNTIME_WSL_KVM)
  }

  cachedInventoryRuntimes = runtimes
  cachedInventoryRuntimesAt = now
  return runtimes
}

/** Clear cached inventory runtimes (call before app-quit cleanup). */
export function clearSgqInventoryRuntimeCache() {
  cachedInventoryRuntimes = null
  cachedInventoryRuntimesAt = 0
}

/**
 * @param {string | null | undefined} runtime
 */
export function dockerRuntimeOptions(runtime) {
  return isWslDockerKvmRuntime(runtime) ? { runtime, dockerRuntime: runtime } : {}
}

/**
 * @param {string} imageRef
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 */
async function inspectImageLabels(imageRef, options = {}) {
  const result = await docker(['image', 'inspect', imageRef, '--format', '{{json .Config.Labels}}'], {
    timeout: DEFAULT_TIMEOUT_MS,
    dockerRuntime: options.dockerRuntime ?? options.runtime
  })
  if (!result.ok) return null
  try {
    const parsed = JSON.parse(result.stdout.trim() || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return null
  }
}

/**
 * @param {Record<string, string | undefined> | null} labels
 * @param {string} labId
 */
function isManagedLabImage(labels, labId) {
  if (!labels || !isSgqManagedResource(labels)) return false
  if (!labId) return true
  return labels[SGQ_LAB] === labId || labels[LEGACY_LAB_ID_LABEL] === labId
}

/**
 * @returns {Promise<{ ready: boolean, message: string, docker: object }>}
 */
export async function checkReady() {
  const dockerInfo = await detectDocker()
  const ready = isDockerReady(dockerInfo)
  return {
    ready,
    message: dockerInfo.message,
    docker: dockerInfo
  }
}

/**
 * @param {string} tag
 */
export async function pullImage(tag, options = {}) {
  const result = await docker(['pull', tag], { timeout: PULL_TIMEOUT_MS, ...options })
  if (!result.ok) {
    throw new Error(result.stderr || result.stdout || `Failed to pull image ${tag}`)
  }
  return { tag, stdout: result.stdout }
}

/**
 * Docker expects -f paths relative to the build context (forward slashes).
 * Absolute Windows paths (especially with spaces) break BuildKit include pattern parsing.
 * @param {string} buildContext
 * @param {string} dockerfilePath
 */
function resolveDockerfileForBuild(buildContext, dockerfilePath) {
  const context = path.resolve(buildContext)
  const dockerfile = path.resolve(dockerfilePath)
  const relative = path.relative(context, dockerfile)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Dockerfile must be inside the build context (${buildContext})`)
  }
  return relative.replace(/\\/g, '/')
}

/**
 * @param {string} buildPath absolute path to build context
 * @param {string} tag
 * @param {{ labId?: string, sessionId?: string, resourceRole?: string, lifecycle?: string, dockerfile?: string, noCache?: boolean, entrypointVersion?: string, platform?: string, dockerRuntime?: string, runtime?: string }} [options]
 */
export async function buildImage(buildPath, tag, options = {}) {
  const resolvedContext = path.resolve(buildPath)
  if (!fs.existsSync(resolvedContext)) {
    throw new Error(`Docker build context not found: ${resolvedContext}`)
  }

  const args = ['build', '-t', tag]
  if (options.dockerfile) {
    args.push('-f', resolveDockerfileForBuild(resolvedContext, options.dockerfile))
  }
  if (options.platform) {
    args.push('--platform', options.platform)
  }
  if (options.noCache) {
    args.push('--no-cache')
  }
  if (options.entrypointVersion) {
    args.push('--build-arg', `SGQ_LAB_ENTRYPOINT_VERSION=${options.entrypointVersion}`)
    args.push('--label', `sgq.lab.entrypoint.version=${options.entrypointVersion}`)
  }
  if (options.labId || options.sessionId) {
    args.push(
      ...dockerLabelArgs(
        buildSgqLabels({
          labId: options.labId,
          sessionId: options.sessionId,
          role: options.resourceRole,
          lifecycle: options.lifecycle ?? LIFECYCLE_PERSISTENT
        })
      )
    )
  }
  args.push('.')
  const runtime = options.dockerRuntime ?? options.runtime
  const result = await docker(args, {
    timeout: BUILD_TIMEOUT_MS,
    cwd: resolvedContext,
    dockerRuntime: runtime
  })
  if (!result.ok) {
    throw new Error(result.stderr || result.stdout || `Failed to build image ${tag}`)
  }
  return { tag, stdout: result.stdout }
}

/**
 * @param {number} port
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(false))
    server.listen({ port, host: '127.0.0.1', exclusive: true }, () => {
      server.close(() => resolve(true))
    })
  })
}

/**
 * @param {string} tag
 */
export async function imageExists(tag, options = {}) {
  const result = await docker(['image', 'inspect', tag], { timeout: DEFAULT_TIMEOUT_MS, ...options })
  return result.ok
}

/**
 * @param {number} preferred
 * @param {number} [attempts]
 */
export async function resolveHostPort(preferred, attempts = 30) {
  if (await isPortAvailable(preferred)) {
    return preferred
  }
  logger.warn('docker', 'Preferred host port busy, selecting fallback', { preferred })
  return findFreeHostPort(preferred, attempts)
}

/**
 * @param {string} host
 * @param {number} port
 * @param {{ attempts?: number, delayMs?: number, timeoutMs?: number }} [options]
 */
export async function waitForTcp(host, port, options = {}) {
  const attempts = options.attempts ?? 20
  const delayMs = options.delayMs ?? 750
  const timeoutMs = options.timeoutMs ?? 2000

  for (let i = 0; i < attempts; i += 1) {
    const open = await new Promise((resolve) => {
      const socket = net.createConnection({ host, port })
      const timer = setTimeout(() => {
        socket.destroy()
        resolve(false)
      }, timeoutMs)
      socket.on('connect', () => {
        clearTimeout(timer)
        socket.end()
        resolve(true)
      })
      socket.on('error', () => {
        clearTimeout(timer)
        resolve(false)
      })
    })
    if (open) return true
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return false
}

/**
 * @param {number} preferred
 * @param {number} [attempts]
 */
export async function findFreeHostPort(preferred, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    const candidate = preferred + i
    if (candidate > 65535) break
    if (await isPortAvailable(candidate)) {
      return candidate
    }
  }
  throw new Error(`No free host port found near ${preferred}`)
}

/**
 * Pick a random localhost port not in use and not in exclude set.
 * @param {Set<number>} [exclude]
 * @param {number} [attempts]
 */
export async function allocateRandomHostPort(exclude = new Set(), attempts = 64) {
  for (let i = 0; i < attempts; i += 1) {
    const candidate = 20000 + Math.floor(Math.random() * 40000)
    if (exclude.has(candidate)) continue
    if (await isPortAvailable(candidate)) {
      return candidate
    }
  }
  for (let port = 20000; port <= 59999; port += 1) {
    if (exclude.has(port)) continue
    if (await isPortAvailable(port)) return port
  }
  throw new Error('No free host port available for lab session')
}

/**
 * @param {string} name
 * @param {{ labels?: Record<string, string>, subnet?: string, driver?: string, dockerRuntime?: string, runtime?: string }} [options]
 */
export async function createBridgeNetwork(name, options = {}) {
  const args = ['network', 'create', '--driver', options.driver ?? 'bridge']
  if (options.subnet) {
    args.push('--subnet', options.subnet)
  }
  const labels = options.labels ?? {}
  for (const [k, v] of Object.entries(labels)) {
    args.push('--label', `${k}=${v}`)
  }
  args.push(name)
  const result = await docker(args, {
    timeout: DEFAULT_TIMEOUT_MS,
    dockerRuntime: options.dockerRuntime ?? options.runtime
  })
  if (!result.ok && !/already exists/i.test(result.stderr || '')) {
    throw new Error(result.stderr || result.stdout || `Failed to create network ${name}`)
  }
  logger.info('docker', 'Bridge network ready', { name, subnet: options.subnet ?? null })
  return { name, subnet: options.subnet ?? null }
}

/**
 * @returns {Promise<{ name: string }[]>}
 */
export async function listManagedNetworks() {
  const rows = await listSgqNetworks({ includeLegacy: true })
  return rows.map((row) => ({ name: row.name }))
}

/**
 * @param {string} name
 */
export async function removeNetwork(name, options = {}) {
  const result = await docker(['network', 'rm', name], {
    timeout: DEFAULT_TIMEOUT_MS,
    dockerRuntime: options.dockerRuntime ?? options.runtime
  })
  if (!result.ok && !/not found|no such network/i.test(result.stderr || '')) {
    logger.warn('docker', 'Network rm failed', { name, stderr: result.stderr })
  }
  return { removed: result.ok }
}

/**
 * Read actual published ports from docker inspect (authoritative).
 * @param {string} nameOrId
 */
export async function inspectContainerPublishedPorts(nameOrId, options = {}) {
  const result = await docker(
    ['inspect', nameOrId, '--format', '{{json .NetworkSettings.Ports}}'],
    { timeout: DEFAULT_TIMEOUT_MS, ...options }
  )
  if (!result.ok) {
    throw new Error(result.stderr || result.stdout || 'Failed to inspect container ports')
  }

  /** @type {Record<string, { HostIp?: string, HostPort?: string }[] | null>} */
  let portsJson = {}
  try {
    portsJson = JSON.parse(result.stdout.trim() || '{}')
  } catch {
    portsJson = {}
  }

  /** @type {{ container: number, protocol: string, host: number, hostIp: string }[]} */
  const mappings = []
  for (const [key, bindings] of Object.entries(portsJson)) {
    if (!bindings?.length) continue
    const [containerPort, protocol = 'tcp'] = key.split('/')
    const binding = bindings[0]
    const hostPort = Number(binding?.HostPort)
    if (!Number.isFinite(hostPort) || hostPort <= 0) continue
    mappings.push({
      container: Number(containerPort),
      protocol: protocol || 'tcp',
      host: hostPort,
      hostIp: binding?.HostIp ?? '127.0.0.1'
    })
  }
  return mappings
}

/**
 * @param {string} nameOrId
 * @param {{ container: number, protocol?: string, purpose?: string, host?: number, bindAll?: boolean, locked?: boolean }[]} definitions
 */
export async function inspectContainerPortMappings(nameOrId, definitions, options = {}) {
  const discovered = await inspectContainerPublishedPorts(nameOrId, options)
  return definitions.map((def) => {
    const protocol = def.protocol ?? 'tcp'
    const found =
      discovered.find((p) => p.container === def.container && p.protocol === protocol) ??
      discovered.find((p) => p.container === def.container) ??
      null

    return {
      container: def.container,
      protocol,
      purpose: def.purpose,
      host: found?.host ?? 0,
      hostIp: found?.hostIp ?? '127.0.0.1',
      published: found ? `${found.hostIp}:${found.host}:${def.container}` : undefined,
      locked: def.locked === true,
      bindAll: def.bindAll === true
    }
  })
}

/**
 * @param {{ name: string, image: string, labId: string, sessionId: string, resourceRole?: string, lifecycle?: string, platform?: string, ports?: { container: number, protocol?: string, purpose?: string, host?: number, bindAll?: boolean, exposeOnly?: boolean }[], portOptions?: { bindAddress?: string, allowLockedHost?: boolean, allowPublicBind?: boolean, excludeHostPorts?: Set<number> }, env?: Record<string, string>, network?: string, networkAliases?: string[], capAdd?: string[], runProfile?: 'lab-hardened' | 'lab-ssh-target' | 'desktop-vm', privileged?: boolean, devices?: string[], timeoutMs?: number, dockerRuntime?: string, runtime?: string, volumes?: { name: string, mountPath: string, labels?: Record<string, string> }[] }} spec
 */
export async function runContainer(spec) {
  const dockerRuntime = spec.dockerRuntime ?? spec.runtime
  const dockerOpts = isWslDockerKvmRuntime(dockerRuntime) ? { runtime: dockerRuntime } : {}
  const publishedDefinitions = []
  const args = [
    'run',
    '-d',
    '--name',
    spec.name,
    ...dockerLabelArgs(
      buildSgqLabels({
        sessionId: spec.sessionId,
        labId: spec.labId,
        role: spec.resourceRole,
        lifecycle: spec.lifecycle ?? LIFECYCLE_EPHEMERAL
      })
    )
  ]

  if (spec.platform) {
    args.push('--platform', spec.platform)
  }

  if (spec.network) {
    args.push('--network', spec.network)
    for (const alias of spec.networkAliases ?? []) {
      if (alias && typeof alias === 'string') {
        args.push('--network-alias', alias)
      }
    }
  }

  const bindAddress = spec.portOptions?.bindAddress ?? '127.0.0.1'
  const allowLockedHost = spec.portOptions?.allowLockedHost === true
  const allowPublicBind = spec.portOptions?.allowPublicBind === true
  const excludeHostPorts = spec.portOptions?.excludeHostPorts ?? new Set()

  if (spec.ports?.length) {
    for (const mapping of spec.ports) {
      if (mapping.exposeOnly) continue

      const protocol = mapping.protocol ?? 'tcp'
      const purpose = mapping.purpose
      const usePublicBind = allowPublicBind && mapping.bindAll === true
      const publishHost = usePublicBind ? '0.0.0.0' : bindAddress

      let publishArg
      let locked = false
      if (allowLockedHost && typeof mapping.host === 'number') {
        const hostPort = await resolveHostPort(mapping.host)
        publishArg = `${publishHost}:${hostPort}:${mapping.container}`
        locked = true
      } else {
        const hostPort = await allocateRandomHostPort(excludeHostPorts)
        excludeHostPorts.add(hostPort)
        publishArg = `${publishHost}:${hostPort}:${mapping.container}`
      }

      args.push('-p', publishArg)
      publishedDefinitions.push({
        container: mapping.container,
        protocol,
        purpose,
        host: mapping.host,
        bindAll: mapping.bindAll === true,
        locked
      })
    }
  }

  if (spec.env) {
    for (const [key, value] of Object.entries(spec.env)) {
      args.push('-e', `${key}=${value}`)
    }
  }

  for (const volume of spec.volumes ?? []) {
    if (!volume?.name || !volume?.mountPath) continue
    args.push('-v', `${volume.name}:${volume.mountPath}`)
  }

  for (const extraHost of spec.extraHosts ?? []) {
    if (extraHost && typeof extraHost === 'string') {
      args.push('--add-host', extraHost)
    }
  }

  const desktopVm = spec.runProfile === 'desktop-vm' || spec.privileged === true
  const hardeningProfile =
    spec.runProfile === 'lab-ssh-target' ? 'lab-ssh-target' : 'lab-hardened'
  if (spec.privileged === true) {
    args.push('--privileged')
  }
  for (const device of spec.devices ?? []) {
    if (device && typeof device === 'string') {
      args.push('--device', device)
    }
  }

  if (!desktopVm) {
    appendContainerHardeningFlags(args, hardeningProfile)
  }

  if (spec.capAdd?.length) {
    for (const cap of spec.capAdd) {
      if (cap && typeof cap === 'string') {
        args.push('--cap-add', cap)
      }
    }
  }

  args.push(spec.image)

  const runTimeout = spec.timeoutMs ?? RUN_TIMEOUT_MS
  const result = await docker(args, { timeout: runTimeout, ...dockerOpts })
  if (!result.ok) {
    const message = result.stderr || result.stdout
    /** @type {Error & { dockerOutput?: string, dockerArgs?: string[] }} */
    let err
    if (/port is already allocated/i.test(message)) {
      err = new Error('Host port is already in use. Try stopping other lab containers.')
    } else if (/Cannot connect to the Docker daemon/i.test(message)) {
      err = new Error('Docker daemon is not running. Start Docker Desktop and retry.')
    } else {
      err = new Error(message || 'Failed to start container')
    }
    err.dockerOutput = message
    err.dockerArgs = args.filter((a) => a !== spec.image)
    throw err
  }

  const containerId = result.stdout.split('\n')[0]?.trim()
  logger.info('docker', 'Container started', { name: spec.name, containerId, labId: spec.labId })

  const portMappings =
    publishedDefinitions.length > 0
      ? await inspectContainerPortMappings(containerId, publishedDefinitions, dockerOpts)
      : []

  return {
    containerId,
    name: spec.name,
    ports: portMappings,
    publicBind: portMappings.some((p) => p.hostIp === '0.0.0.0'),
    dockerRuntime: dockerRuntime ?? null
  }
}

/**
 * @param {string} nameOrId
 */
export async function stopContainer(nameOrId, options = {}) {
  const result = await docker(['stop', nameOrId], { timeout: DEFAULT_TIMEOUT_MS, ...options })
  if (!result.ok && !/is not running/i.test(result.stderr)) {
    throw new Error(result.stderr || `Failed to stop container ${nameOrId}`)
  }
  return { stopped: true }
}

/**
 * @param {string} nameOrId
 * @param {{ removeVolumes?: boolean } & Record<string, unknown>} [options]
 */
export async function removeContainer(nameOrId, options = {}) {
  const args = ['rm', '-f']
  if (options.removeVolumes === true) {
    args.push('-v')
  }
  args.push(nameOrId)
  const result = await docker(args, { timeout: DEFAULT_TIMEOUT_MS, ...options })
  if (!result.ok && !/No such container/i.test(result.stderr)) {
    throw new Error(result.stderr || `Failed to remove container ${nameOrId}`)
  }
  return { removed: true }
}

/**
 * @param {string} nameOrId
 */
export async function inspectContainer(nameOrId, options = {}) {
  const result = await docker(['inspect', nameOrId, '--format', '{{json .State.Status}}'], {
    timeout: DEFAULT_TIMEOUT_MS,
    ...options
  })
  if (!result.ok) {
    throw new Error(result.stderr || `Failed to inspect container ${nameOrId}`)
  }
  const status = result.stdout.replace(/^"|"$/g, '')
  return { status, raw: result.stdout }
}

/**
 * Full inspect payload for developer diagnostics (env values redacted by caller).
 * @param {string} nameOrId
 */
export async function inspectContainerDiagnostics(nameOrId, options = {}) {
  const result = await docker(['inspect', nameOrId], { timeout: DEFAULT_TIMEOUT_MS, ...options })
  if (!result.ok) {
    throw new Error(result.stderr || `Failed to inspect container ${nameOrId}`)
  }
  const parsed = JSON.parse(result.stdout.trim())
  const info = Array.isArray(parsed) ? parsed[0] : parsed
  if (!info) {
    throw new Error(`No inspect data for container ${nameOrId}`)
  }

  const config = info.Config ?? {}
  const hostConfig = info.HostConfig ?? {}
  const networks = info.NetworkSettings ?? {}
  /** @type {string[]} */
  const portBindings = []
  const ports = networks.Ports ?? {}
  for (const [containerPort, bindings] of Object.entries(ports)) {
    if (!Array.isArray(bindings) || bindings.length === 0) continue
    for (const binding of bindings) {
      const hostIp = binding.HostIp ?? '0.0.0.0'
      const hostPort = binding.HostPort ?? '?'
      portBindings.push(`${hostIp}:${hostPort} -> ${containerPort}`)
    }
  }

  const devices = (hostConfig.Devices ?? [])
    .map((d) => {
      if (!d) return null
      if (typeof d === 'string') return d
      const path = d.PathOnHost ?? d.pathOnHost
      const cgroup = d.PathInContainer ?? d.pathInContainer
      return path && cgroup ? `${path}:${cgroup}` : path ?? cgroup ?? null
    })
    .filter(Boolean)

  return {
    id: info.Id ?? null,
    name: info.Name?.replace(/^\//, '') ?? null,
    image: config.Image ?? info.Image ?? null,
    platform: info.Platform ?? config.Labels?.['org.opencontainers.image.ref.name'] ?? null,
    created: info.Created ?? null,
    cmd: config.Cmd ?? [],
    entrypoint: config.Entrypoint ?? [],
    env: Array.isArray(config.Env) ? config.Env : [],
    privileged: hostConfig.Privileged === true,
    readonlyRootfs: hostConfig.ReadonlyRootfs === true,
    capAdd: hostConfig.CapAdd ?? [],
    capDrop: hostConfig.CapDrop ?? [],
    securityOpt: hostConfig.SecurityOpt ?? [],
    devices,
    portBindings,
    networkMode: hostConfig.NetworkMode ?? null
  }
}

/**
 * @param {string} nameOrId
 */
export async function inspectContainerState(nameOrId, options = {}) {
  const result = await docker(
    [
      'inspect',
      nameOrId,
      '--format',
      '{{json .State}}'
    ],
    { timeout: DEFAULT_TIMEOUT_MS, ...options }
  )
  if (!result.ok) {
    throw new Error(result.stderr || `Failed to inspect container ${nameOrId}`)
  }
  try {
    const state = JSON.parse(result.stdout.trim())
    return {
      status: String(state?.Status ?? 'unknown'),
      running: state?.Running === true,
      exitCode: typeof state?.ExitCode === 'number' ? state.ExitCode : null,
      error: typeof state?.Error === 'string' ? state.Error : ''
    }
  } catch {
    return { status: 'unknown', running: false, exitCode: null, error: '' }
  }
}

/**
 * @param {string} nameOrId
 * @param {{ tail?: number, dockerRuntime?: string, runtime?: string }} [options]
 */
export async function getContainerLogs(nameOrId, options = {}) {
  const tail = options.tail ?? 80
  const result = await docker(['logs', '--tail', String(tail), nameOrId], {
    timeout: DEFAULT_TIMEOUT_MS,
    dockerRuntime: options.dockerRuntime ?? options.runtime
  })
  if (!result.ok) {
    return { ok: false, logs: result.stderr || result.stdout || '' }
  }
  const logs = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  return { ok: true, logs }
}

/**
 * @param {string} nameOrId
 * @param {{ timeoutMs?: number, pollMs?: number, logLabel?: string }} [options]
 */
export async function waitForContainerRunning(nameOrId, options = {}) {
  const timeoutMs = options.timeoutMs ?? 10_000
  const pollMs = options.pollMs ?? 500
  const started = Date.now()
  const dockerOpts =
    isWslDockerKvmRuntime(options.dockerRuntime ?? options.runtime) ?
      { runtime: options.dockerRuntime ?? options.runtime }
    : {}

  while (Date.now() - started < timeoutMs) {
    const state = await inspectContainerState(nameOrId, dockerOpts)
    if (state.running) {
      return { running: true, status: state.status, exitCode: null, logs: '' }
    }
    if (state.status === 'exited' || state.status === 'dead') {
      const logResult = await getContainerLogs(nameOrId, dockerOpts)
      return {
        running: false,
        status: state.status,
        exitCode: state.exitCode,
        logs: logResult.logs,
        error: state.error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  const state = await inspectContainerState(nameOrId, dockerOpts).catch(() => ({
    status: 'unknown',
    running: false,
    exitCode: null,
    error: ''
  }))
  const logResult = await getContainerLogs(nameOrId, dockerOpts)
  return {
    running: state.running === true,
    status: state.status,
    exitCode: state.exitCode,
    logs: logResult.logs,
    error: state.error,
    timedOut: state.running !== true
  }
}

/**
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 * @returns {Promise<string[]>}
 */
export async function listDockerNetworkSubnets(options = {}) {
  const result = await docker(['network', 'ls', '--format', '{{.Name}}'], {
    timeout: DEFAULT_TIMEOUT_MS,
    dockerRuntime: options.dockerRuntime ?? options.runtime
  })
  if (!result.ok) {
    throw new Error(result.stderr || 'Failed to list Docker networks')
  }
  const names = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  /** @type {string[]} */
  const subnets = []
  for (const name of names) {
    const subnet = await getNetworkSubnet(name, options)
    if (subnet) subnets.push(subnet)
  }
  return subnets
}

/**
 * @param {string} networkName
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 * @returns {Promise<string | null>}
 */
export async function getNetworkSubnet(networkName, options = {}) {
  const result = await docker(
    ['network', 'inspect', networkName, '--format', '{{range .IPAM.Config}}{{.Subnet}}{{end}}'],
    {
      timeout: DEFAULT_TIMEOUT_MS,
      dockerRuntime: options.dockerRuntime ?? options.runtime
    }
  )
  if (!result.ok) return null
  const subnet = result.stdout.trim()
  return subnet.length > 0 ? subnet : null
}

/**
 * @param {string} nameOrId
 * @param {string} networkName
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 * @returns {Promise<string | null>}
 */
export async function getContainerNetworkIp(nameOrId, networkName, options = {}) {
  const result = await docker(
    ['inspect', nameOrId, '--format', '{{json .NetworkSettings.Networks}}'],
    {
      timeout: DEFAULT_TIMEOUT_MS,
      dockerRuntime: options.dockerRuntime ?? options.runtime
    }
  )
  if (!result.ok) {
    return null
  }
  try {
    const networks = JSON.parse(result.stdout.trim())
    const entry = networks?.[networkName]
    const ip = entry?.IPAddress
    return typeof ip === 'string' && ip.length > 0 ? ip : null
  } catch {
    return null
  }
}

/**
 * @param {string} nameOrId
 * @param {Record<string, unknown>} [options]
 * @returns {Promise<Record<string, string> | null>}
 */
export async function inspectContainerLabels(nameOrId, options = {}) {
  const result = await docker(['inspect', nameOrId, '--format', '{{json .Config.Labels}}'], {
    timeout: DEFAULT_TIMEOUT_MS,
    ...options
  })
  if (!result.ok) return null
  try {
    const parsed = JSON.parse(result.stdout.trim() || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return null
  }
}

/**
 * @param {{ sessionId?: string, labId?: string, lifecycle?: string, includeLegacy?: boolean }} [filters]
 * @returns {Promise<{ name: string, labels: Record<string, string>, role?: string, lifecycle: string, sessionId?: string, labId?: string, dockerRuntime?: string | null }[]>}
 */
export async function listSgqContainers(filters = {}) {
  /** @type {{ name: string, labels: Record<string, string>, role?: string, lifecycle: string, sessionId?: string, labId?: string, dockerRuntime?: string | null }[]} */
  const rows = []
  const seen = new Set()
  const runtimes = await resolveSgqInventoryRuntimes()

  for (const runtime of runtimes) {
    const dockerOpts = dockerRuntimeOptions(runtime)

    /** @param {string[]} dockerArgs */
    async function collect(dockerArgs) {
      const result = await docker(dockerArgs, { timeout: DEFAULT_TIMEOUT_MS, ...dockerOpts })
      if (!result.ok) return
      for (const line of result.stdout.split('\n').map((row) => row.trim()).filter(Boolean)) {
        const name = line
        if (seen.has(name)) continue
        seen.add(name)
        const labels = (await inspectContainerLabels(name, dockerOpts)) ?? {}
        if (!isSgqManagedResource(labels)) continue
        rows.push({
          name,
          labels,
          role: labels[SGQ_ROLE],
          lifecycle: resourceLifecycle(labels),
          sessionId: resourceSessionId(labels) ?? undefined,
          labId: labels[SGQ_LAB] ?? labels[LEGACY_LAB_ID_LABEL],
          dockerRuntime: runtime
        })
      }
    }

    /** @type {string[]} */
    const sgqArgs = ['ps', '-a', '--filter', `label=${SGQ_MANAGED}=true`, '--format', '{{.Names}}']
    if (filters.sessionId) sgqArgs.push('--filter', `label=${SGQ_SESSION}=${filters.sessionId}`)
    if (filters.labId) sgqArgs.push('--filter', `label=${SGQ_LAB}=${filters.labId}`)
    if (filters.lifecycle) sgqArgs.push('--filter', `label=${SGQ_LIFECYCLE}=${filters.lifecycle}`)
    await collect(sgqArgs)

    if (filters.includeLegacy !== false) {
      /** @type {string[]} */
      const legacyArgs = ['ps', '-a', '--filter', `label=${LEGACY_MANAGED_LABEL}=true`, '--format', '{{.Names}}']
      if (filters.sessionId) legacyArgs.push('--filter', `label=${LEGACY_SESSION_ID_LABEL}=${filters.sessionId}`)
      if (filters.labId) legacyArgs.push('--filter', `label=${LEGACY_LAB_ID_LABEL}=${filters.labId}`)
      await collect(legacyArgs)
    }
  }

  if (filters.lifecycle) {
    return rows.filter((row) => row.lifecycle === filters.lifecycle)
  }
  return rows
}

/**
 * @param {{ sessionId?: string, labId?: string, lifecycle?: string, includeLegacy?: boolean }} [filters]
 */
export async function listSgqNetworks(filters = {}) {
  /** @type {{ name: string, labels: Record<string, string>, lifecycle: string, sessionId?: string, labId?: string, dockerRuntime?: string | null }[]} */
  const rows = []
  const seen = new Set()
  const runtimes = await resolveSgqInventoryRuntimes()

  for (const runtime of runtimes) {
    const dockerOpts = dockerRuntimeOptions(runtime)

    /** @param {string[]} dockerArgs */
    async function collect(dockerArgs) {
      const result = await docker(dockerArgs, { timeout: DEFAULT_TIMEOUT_MS, ...dockerOpts })
      if (!result.ok) return
      for (const name of result.stdout.split('\n').map((row) => row.trim()).filter(Boolean)) {
        if (seen.has(name)) continue
        seen.add(name)
        const labels = (await inspectNetworkLabels(name, dockerOpts)) ?? {}
        if (!isSgqManagedResource(labels)) continue
        rows.push({
          name,
          labels,
          lifecycle: resourceLifecycle(labels),
          sessionId: resourceSessionId(labels) ?? undefined,
          labId: labels[SGQ_LAB] ?? labels[LEGACY_LAB_ID_LABEL],
          dockerRuntime: runtime
        })
      }
    }

    /** @type {string[]} */
    const sgqArgs = ['network', 'ls', '--filter', `label=${SGQ_MANAGED}=true`, '--format', '{{.Name}}']
    if (filters.sessionId) sgqArgs.push('--filter', `label=${SGQ_SESSION}=${filters.sessionId}`)
    if (filters.lifecycle) sgqArgs.push('--filter', `label=${SGQ_LIFECYCLE}=${filters.lifecycle}`)
    await collect(sgqArgs)

    if (filters.includeLegacy !== false) {
      /** @type {string[]} */
      const legacyArgs = ['network', 'ls', '--filter', `label=${LEGACY_MANAGED_LABEL}=true`, '--format', '{{.Name}}']
      if (filters.sessionId) legacyArgs.push('--filter', `label=${LEGACY_SESSION_ID_LABEL}=${filters.sessionId}`)
      await collect(legacyArgs)
    }
  }

  if (filters.lifecycle) {
    return rows.filter((row) => row.lifecycle === filters.lifecycle)
  }
  return rows
}

/**
 * @param {string} networkName
 * @param {Record<string, unknown>} [options]
 * @returns {Promise<Record<string, string> | null>}
 */
async function inspectNetworkLabels(networkName, options = {}) {
  const result = await docker(['network', 'inspect', networkName, '--format', '{{json .Labels}}'], {
    timeout: DEFAULT_TIMEOUT_MS,
    ...options
  })
  if (!result.ok) return null
  try {
    const parsed = JSON.parse(result.stdout.trim() || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return null
  }
}

/**
 * @param {{ sessionId?: string, labId?: string, lifecycle?: string }} [filters]
 */
export async function listSgqVolumes(filters = {}) {
  /** @type {{ name: string, labels: Record<string, string>, lifecycle: string, sessionId?: string, labId?: string, dockerRuntime?: string | null }[]} */
  const rows = []
  const seen = new Set()
  const runtimes = await resolveSgqInventoryRuntimes()

  for (const runtime of runtimes) {
    const dockerOpts = dockerRuntimeOptions(runtime)
    /** @type {string[]} */
    const args = ['volume', 'ls', '--filter', `label=${SGQ_MANAGED}=true`, '--format', '{{.Name}}']
    if (filters.sessionId) args.push('--filter', `label=${SGQ_SESSION}=${filters.sessionId}`)
    if (filters.lifecycle) args.push('--filter', `label=${SGQ_LIFECYCLE}=${filters.lifecycle}`)
    const result = await docker(args, { timeout: DEFAULT_TIMEOUT_MS, ...dockerOpts })
    if (!result.ok) continue

    for (const name of result.stdout.split('\n').map((row) => row.trim()).filter(Boolean)) {
      if (seen.has(name)) continue
      seen.add(name)
      const labels = (await inspectVolumeLabels(name, dockerOpts)) ?? {}
      if (!isSgqManagedResource(labels)) continue
      rows.push({
        name,
        labels,
        lifecycle: resourceLifecycle(labels),
        sessionId: resourceSessionId(labels) ?? undefined,
        labId: labels[SGQ_LAB] ?? labels[LEGACY_LAB_ID_LABEL],
        dockerRuntime: runtime
      })
    }
  }

  if (filters.lifecycle) {
    return rows.filter((row) => row.lifecycle === filters.lifecycle)
  }
  return rows
}

/**
 * @param {string} volumeName
 * @param {Record<string, unknown>} [options]
 * @returns {Promise<Record<string, string> | null>}
 */
async function inspectVolumeLabels(volumeName, options = {}) {
  const result = await docker(['volume', 'inspect', volumeName, '--format', '{{json .Labels}}'], {
    timeout: DEFAULT_TIMEOUT_MS,
    ...options
  })
  if (!result.ok) return null
  try {
    const parsed = JSON.parse(result.stdout.trim() || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return null
  }
}

/**
 * @param {string} name
 * @param {{ sessionId?: string, labId?: string, role?: string, lifecycle?: string, labels?: Record<string, string> }} [options]
 */
export async function createNamedVolume(name, options = {}) {
  const args = ['volume', 'create', ...dockerLabelArgs(buildSgqLabels(options)), name]
  const result = await docker(args, { timeout: DEFAULT_TIMEOUT_MS })
  if (!result.ok && !/already exists/i.test(result.stderr || '')) {
    throw new Error(result.stderr || result.stdout || `Failed to create volume ${name}`)
  }
  return { name }
}

/**
 * @param {string} name
 */
export async function removeVolume(name, options = {}) {
  const result = await docker(['volume', 'rm', name], {
    timeout: DEFAULT_TIMEOUT_MS,
    dockerRuntime: options.dockerRuntime ?? options.runtime
  })
  if (!result.ok && !/not found|no such volume/i.test(result.stderr || '')) {
    throw new Error(result.stderr || `Failed to remove volume ${name}`)
  }
  return { removed: result.ok }
}

/**
 * @param {{ sessionId?: string, labId?: string, lifecycle?: string, includeLegacy?: boolean }} [filters]
 */
export async function listSgqImages(filters = {}) {
  /** @type {{ reference: string, imageId: string, labels: Record<string, string>, lifecycle: string, sessionId?: string, labId?: string, dockerRuntime?: string | null }[]} */
  const rows = []
  const seen = new Set()
  const runtimes = await resolveSgqInventoryRuntimes()

  for (const runtime of runtimes) {
    const dockerOpts = dockerRuntimeOptions(runtime)

    /** @param {string[]} dockerArgs */
    async function collect(dockerArgs) {
      const result = await docker(dockerArgs, { timeout: DEFAULT_TIMEOUT_MS, ...dockerOpts })
      if (!result.ok) return
      for (const line of result.stdout.split('\n').map((row) => row.trim()).filter(Boolean)) {
        const [reference, imageId] = line.split('\t')
        const ref = reference && reference !== '<none>:<none>' ? reference : imageId
        if (!ref || seen.has(ref)) continue
        seen.add(ref)
        const labels = (await inspectImageLabels(ref, dockerOpts)) ?? {}
        if (!isSgqManagedResource(labels)) continue
        rows.push({
          reference: ref,
          imageId: imageId ?? ref,
          labels,
          lifecycle: resourceLifecycle(labels),
          sessionId: resourceSessionId(labels) ?? undefined,
          labId: labels[SGQ_LAB] ?? labels[LEGACY_LAB_ID_LABEL],
          dockerRuntime: runtime
        })
      }
    }

    /** @type {string[]} */
    const sgqArgs = ['images', '--filter', `label=${SGQ_MANAGED}=true`, '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}']
    if (filters.sessionId) sgqArgs.push('--filter', `label=${SGQ_SESSION}=${filters.sessionId}`)
    if (filters.lifecycle) sgqArgs.push('--filter', `label=${SGQ_LIFECYCLE}=${filters.lifecycle}`)
    await collect(sgqArgs)

    if (filters.includeLegacy !== false) {
      /** @type {string[]} */
      const legacyArgs = [
        'images',
        '--filter',
        `label=${LEGACY_MANAGED_LABEL}=true`,
        '--format',
        '{{.Repository}}:{{.Tag}}\t{{.ID}}'
      ]
      if (filters.sessionId) legacyArgs.push('--filter', `label=${LEGACY_SESSION_ID_LABEL}=${filters.sessionId}`)
      await collect(legacyArgs)
    }
  }

  if (filters.labId) {
    return rows.filter((row) => row.labId === filters.labId)
  }
  if (filters.lifecycle) {
    return rows.filter((row) => row.lifecycle === filters.lifecycle)
  }
  return rows
}

/**
 * @returns {Promise<{ name: string, status: string, labId?: string, sessionId?: string }[]>}
 */
export async function listManagedContainers() {
  const rows = await listSgqContainers({ includeLegacy: true })
  return rows.map((row) => ({
    name: row.name,
    status: 'unknown',
    labId: row.labId,
    sessionId: row.sessionId
  }))
}

/**
 * @returns {Promise<{ reference: string, labId: string }[]>}
 */
export async function listManagedImages() {
  const rows = await listSgqImages({ includeLegacy: true })
  return rows
    .filter((row) => row.labId)
    .map((row) => ({ reference: row.reference, labId: row.labId }))
}

/**
 * @param {string} imageRef
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 * @returns {Promise<string | null>}
 */
export async function getLabImageEntrypointVersion(imageRef, options = {}) {
  const labels = await inspectImageLabels(imageRef, options)
  const version = labels?.['sgq.lab.entrypoint.version']
  return typeof version === 'string' && version.length > 0 ? version : null
}

/**
 * Remove a locally managed lab image only when it carries our managed labels.
 * @param {string} imageRef
 * @param {string} labId
 * @param {{ dockerRuntime?: string | null, runtime?: string | null }} [options]
 */
export async function removeManagedLabImage(imageRef, labId, options = {}) {
  const explicitRuntime = options.dockerRuntime ?? options.runtime ?? null
  /** @type {(string | null)[]} */
  const runtimes =
    explicitRuntime != null
      ? [explicitRuntime]
      : process.platform === 'win32'
        ? [null, DOCKER_RUNTIME_WSL_KVM]
        : [null]

  /** @type {Record<string, string> | null} */
  let labels = null
  /** @type {string | null} */
  let resolvedRuntime = null
  for (const runtime of runtimes) {
    const dockerOpts = dockerRuntimeOptions(runtime)
    labels = await inspectImageLabels(imageRef, dockerOpts)
    if (isManagedLabImage(labels, labId)) {
      resolvedRuntime = runtime
      break
    }
  }

  if (!isManagedLabImage(labels, labId)) {
    return { removed: false, skipped: true, reason: 'not_managed' }
  }

  const result = await docker(['rmi', imageRef], {
    timeout: DEFAULT_TIMEOUT_MS,
    ...dockerRuntimeOptions(resolvedRuntime)
  })
  if (!result.ok && !/No such image/i.test(result.stderr)) {
    throw new Error(result.stderr || `Failed to remove image ${imageRef}`)
  }
  logger.info('docker', 'Managed lab image removed', { imageRef, labId })
  return { removed: true }
}

/**
 * @param {{ labelFilter?: string }} [options]
 * @deprecated Use listManagedContainers
 */
export async function listContainers(options = {}) {
  const rows = await listManagedContainers()
  if (options.labelFilter) {
    return rows.filter((row) => row.status.includes(options.labelFilter))
  }
  return rows
}

/**
 * @param {string} containerId
 * @param {string[]} argv
 * @param {{ timeout?: number, dockerRuntime?: string, runtime?: string }} [options]
 */
export async function exec(containerId, argv, options = {}) {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new Error('exec argv must be a non-empty array')
  }
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS
  /** @type {string[]} */
  const args = ['exec']
  if (options.env && typeof options.env === 'object') {
    for (const [key, value] of Object.entries(options.env)) {
      if (value === undefined || value === null) continue
      args.push('-e', `${key}=${String(value)}`)
    }
  }
  args.push(containerId, ...argv)
  const result = await docker(args, {
    timeout,
    dockerRuntime: options.dockerRuntime ?? options.runtime
  })
  return {
    ok: result.ok,
    code: result.code,
    exitCode: result.code,
    stdout: result.stdout,
    stderr: result.stderr
  }
}

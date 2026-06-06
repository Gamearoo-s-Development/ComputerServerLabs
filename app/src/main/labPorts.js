/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const DEFAULT_LOOPBACK_HOST = '127.0.0.1'
/** VirtualBox NAT default gateway — reachable from guests for host-published lab ports. */
export const VBOX_NAT_GATEWAY_HOST = '10.0.2.2'
export const SANDBOX_SSH_TARGET = 'lab-target'
export const SANDBOX_SSH_PORT = 22
export const INTERNAL_SSH_CONTAINER_PORT = 22

const WEB_PURPOSES = new Set(['web', 'http', 'https'])
const HOST_EXPOSE_PURPOSES = new Set(['web', 'http', 'https', 'api', 'database', 'custom'])

/**
 * @param {{ purpose?: string, container?: number, containerPort?: number }} def
 */
export function isSshContainerPort(def) {
  const purpose = String(def.purpose ?? '').toLowerCase()
  const container = def.containerPort ?? def.container
  return purpose === 'ssh' || container === INTERNAL_SSH_CONTAINER_PORT
}

/**
 * @param {string | undefined} purpose
 */
export function isWebPurpose(purpose) {
  return WEB_PURPOSES.has(String(purpose ?? '').toLowerCase())
}

/**
 * SSH target on the private lab Docker network.
 * @param {string} [targetHost]
 * @param {number} [targetPort]
 * @param {string | null} [internalIp]
 */
export function getInternalLabSshRoute(
  targetHost = SANDBOX_SSH_TARGET,
  targetPort = INTERNAL_SSH_CONTAINER_PORT,
  internalIp = null
) {
  const ip = typeof internalIp === 'string' && internalIp.trim() ? internalIp.trim() : null
  const host = ip ?? targetHost
  return {
    host,
    port: targetPort,
    protocol: 'tcp',
    purpose: 'ssh',
    ...(ip ? { internalIp: ip, networkAlias: SANDBOX_SSH_TARGET } : {})
  }
}

/**
 * @param {string} username
 * @param {string} targetHost
 * @param {number} [targetPort]
 */
export function buildInternalSshCommand(username, targetHost, targetPort = INTERNAL_SSH_CONTAINER_PORT) {
  if (targetPort === INTERNAL_SSH_CONTAINER_PORT) {
    return `ssh ${username}@${targetHost}`
  }
  return `ssh ${username}@${targetHost} -p ${targetPort}`
}

/**
 * @param {string} username
 * @param {string} password
 * @param {string} targetHost
 * @param {number} [targetPort]
 * @param {string | null} [internalIp]
 */
export function buildInternalLabConnection(
  username,
  password,
  targetHost,
  targetPort = INTERNAL_SSH_CONTAINER_PORT,
  internalIp = null
) {
  return {
    host: targetHost,
    port: targetPort,
    protocol: 'ssh',
    username,
    password,
    command: buildInternalSshCommand(username, targetHost, targetPort),
    ...(internalIp ? { internalIp } : {})
  }
}

/**
 * @deprecated Host-published SSH is disabled for lab sessions.
 */
export function getSandboxSshEndpoint(targetHost = SANDBOX_SSH_TARGET) {
  return {
    host: targetHost,
    port: SANDBOX_SSH_PORT,
    purpose: 'ssh',
    protocol: 'tcp'
  }
}

/**
 * @param {{ purpose?: string, container: number }[]} portDefs
 */
export function labHasSshPort(portDefs) {
  return portDefs.some((p) => isSshContainerPort(p))
}

/**
 * @deprecated External SSH is not published for normal lab sessions.
 */
export function allowExternalSshAccess(settings) {
  return settings.developerMode === true && settings.labBuilderUnsafeOverride === true
}

/**
 * @param {ReturnType<typeof normalizeLabPortDefinitions>[number]} def
 */
function resolveExposeToHost(def) {
  if (def.exposeToHost === true) return true
  return false
}

/**
 * @param {ReturnType<typeof normalizeLabPortDefinitions>[number]} def
 * @param {boolean} exposeToHost
 */
function resolveShowToUser(def, exposeToHost) {
  if (def.showToUser === true) return true
  if (def.showToUser === false) return false
  if (isSshContainerPort(def)) return def.exposeToHost === true
  return exposeToHost
}

/**
 * Port policy: localhost-only host bind; SSH internal unless explicitly exposed.
 *
 * @param {ReturnType<typeof normalizeLabPortDefinitions>} portDefs
 */
export function applySessionPortPolicy(portDefs) {
  return portDefs.map((p) => {
    const exposeToHost = resolveExposeToHost(p)
    const showToUser = resolveShowToUser(p, exposeToHost)
    return {
      ...p,
      exposeToHost,
      showToUser,
      exposeOnly: !exposeToHost,
      bindAll: exposeToHost ? p.bindAll === true : false
    }
  })
}

/**
 * Ports published to the host (excludes container-only / exposeOnly).
 * @param {ReturnType<typeof normalizeLabPortDefinitions>} portDefs
 */
export function getHostPublishedPortDefinitions(portDefs) {
  return portDefs.filter((p) => p.exposeToHost === true && p.exposeOnly !== true)
}

/**
 * @param {{ purpose?: string, container: number }[]} portDefs
 */
export function findSshPortMapping(ports) {
  return ports.find((p) => isSshContainerPort(p)) ?? null
}

/**
 * @param {number} container
 */
export function inferPortPurpose(container) {
  if (container === 22) return 'ssh'
  if (container === 80 || container === 8080) return 'web'
  if (container === 443) return 'web'
  if (container === 3306 || container === 5432) return 'database'
  return 'custom'
}

/**
 * @param {string | undefined} purpose
 * @param {number} container
 */
export function normalizePortPurpose(purpose, container) {
  const raw = String(purpose ?? inferPortPurpose(container)).toLowerCase()
  if (raw === 'http' || raw === 'https') return 'web'
  return raw
}

/**
 * @param {object[] | undefined} labPorts
 */
export function normalizeLabPortDefinitions(labPorts) {
  const raw =
    Array.isArray(labPorts) && labPorts.length > 0
      ? labPorts
      : [{ container: INTERNAL_SSH_CONTAINER_PORT, protocol: 'tcp', purpose: 'ssh' }]

  return raw.map((p) => {
    const container = Number(p.containerPort ?? p.container)
    const purpose = normalizePortPurpose(p.purpose, container)
    return {
      container,
      containerPort: container,
      protocol: String(p.protocol ?? 'tcp').toLowerCase(),
      purpose,
      host: typeof p.host === 'number' ? p.host : undefined,
      bindAll: p.bindAll === true,
      exposeToHost: p.exposeToHost,
      showToUser: p.showToUser,
      label: typeof p.label === 'string' ? p.label : undefined,
      hint: typeof p.hint === 'string' ? p.hint : undefined,
      spoilLevel: typeof p.spoilLevel === 'string' ? p.spoilLevel : undefined
    }
  })
}

/**
 * @param {{ purpose?: string, host: number, hostIp?: string, container: number, protocol?: string, label?: string }} port
 */
export function formatPortMappingLabel(port) {
  const purpose = String(port.purpose ?? inferPortPurpose(port.container)).toUpperCase()
  const hostIp = port.hostIp ?? '—'
  const hostPort = port.hostPort ?? port.host ?? 0
  const containerPort = port.containerPort ?? port.container
  const proto = port.protocol ?? 'tcp'
  const title = port.label ? `${port.label} (${purpose})` : purpose
  if (!hostPort) {
    return `${title.padEnd(16)} container:${containerPort}/${proto} (private lab network only)`
  }
  return `${title.padEnd(16)} ${hostIp}:${hostPort} -> container:${containerPort}/${proto}`
}

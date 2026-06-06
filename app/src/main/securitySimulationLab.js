/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  buildServiceAccessUrl,
  defaultServiceLabel,
  normalizeServicePurpose
} from './labServiceRoutes.js'
import { DEFAULT_LOOPBACK_HOST, SANDBOX_SSH_TARGET } from './labPorts.js'

export const SECURITY_SIMULATION_CATEGORY = 'Security Simulation'

export const SECURITY_SUBCATEGORIES = [
  'Enumeration',
  'Web Exploitation',
  'Privilege Escalation',
  'Password Recovery',
  'Misconfiguration',
  'CTF Challenge'
]

export const ACCESS_MODE = {
  PROVIDED: 'provided',
  DISCOVER: 'discover'
}

/** Security-focused objective types (most use manual autoCheck + answer submit). */
export const SECURITY_OBJECTIVE_TYPES = [
  'enumeratePorts',
  'identifyService',
  'findUsername',
  'findPassword',
  'obtainSshAccess',
  'findUserFlag',
  'privilegeEscalation',
  'findRootFlag',
  'submitFlag',
  'answerQuestion'
]

/**
 * @param {object | null | undefined} lab
 */
export function isSecuritySimulationLab(lab) {
  if (!lab) return false
  if (lab.securitySimulation === true) return true
  const category = String(lab.category ?? '').trim()
  if (category === SECURITY_SIMULATION_CATEGORY) return true
  return /^security\s+simulation/i.test(category)
}

/**
 * @param {object | null | undefined} lab
 * @returns {'provided' | 'discover'}
 */
export function resolveLabAccessMode(lab) {
  if (lab?.accessMode === ACCESS_MODE.DISCOVER || lab?.accessMode === ACCESS_MODE.PROVIDED) {
    return lab.accessMode
  }
  if (isSecuritySimulationLab(lab) && lab?.hideDirectSshCommand === true) {
    return ACCESS_MODE.DISCOVER
  }
  return ACCESS_MODE.PROVIDED
}

/**
 * @param {object | null | undefined} lab
 */
export function shouldHideLabCredentials(lab) {
  return resolveLabAccessMode(lab) === ACCESS_MODE.DISCOVER
}

/**
 * CTF target service route definitions (lab.services when entries are objects).
 * @param {object | null | undefined} lab
 */
export function getTargetServiceDefinitions(lab) {
  const candidates = [lab?.targetServices, lab?.services].filter(Array.isArray)
  for (const raw of candidates) {
    if (raw.length === 0) continue
    if (typeof raw[0] === 'object' && raw[0] !== null && !Array.isArray(raw[0])) {
      return raw
    }
  }
  return []
}

/**
 * @param {object} route
 */
export function redactConnectionRoute(route) {
  if (!route) return route
  const showCredentials = route.showCredentials !== false
  if (showCredentials) return route
  return {
    ...route,
    username: undefined,
    password: undefined,
    command: null,
    showCredentials: false
  }
}

/**
 * Hide noVNC/RDP/VNC URLs from the renderer until the user opens the in-app viewer.
 * @param {object} session
 */
function redactDesktopViewerFromSession(session) {
  const helper = session?.helper
  if (!helper) return session
  const isDesktop =
    typeof helper.workstationProvider === 'string' &&
    helper.workstationProvider.startsWith('desktop-container-')
  if (!isDesktop) return session
  return {
    ...session,
    helper: {
      ...helper,
      workstationDesktopUrl: null,
      workstationAccessRoutes: (helper.workstationAccessRoutes ?? []).map((route) => {
        if (route.type === 'novnc') {
          return { ...route, url: null, showToUser: false }
        }
        if (route.type === 'rdp' || route.type === 'vnc') {
          return { ...route, showToUser: false }
        }
        return route
      })
    }
  }
}

/**
 * @param {object} session
 * @param {object | null | undefined} lab
 */
export function sanitizeSessionForClient(session, lab) {
  const preparing =
    session?.status === 'preparing' ||
    session?.awaitingDesktopEnter === true ||
    session?.activated === false

  if (preparing) {
    return redactDesktopViewerFromSession({
      ...session,
      status: session.status ?? 'preparing',
      startedAt: null,
      objectives: [],
      credentials: {
        ...(session.credentials ?? {}),
        username: null,
        password: null
      },
      workstationCredentials: session.workstationCredentials
        ? {
            ...session.workstationCredentials,
            password: null
          }
        : null,
      connection: session.connection
        ? {
            ...session.connection,
            username: null,
            password: null,
            command: null
          }
        : null,
      connectionRoutes: (session.connectionRoutes ?? []).map(redactConnectionRoute),
      serviceRoutes: (session.serviceRoutes ?? []).filter((r) => r?.showCredentials !== true),
      accessMode: resolveLabAccessMode(lab),
      securitySimulation: isSecuritySimulationLab(lab)
    })
  }

  if (!session || !shouldHideLabCredentials(lab)) {
    return redactDesktopViewerFromSession({
      ...session,
      accessMode: resolveLabAccessMode(lab),
      securitySimulation: isSecuritySimulationLab(lab)
    })
  }

  const credentials = {
    ...session.credentials,
    username: null,
    password: null
  }

  const connectionRoutes = (session.connectionRoutes ?? []).map(redactConnectionRoute)
  const connection = session.connection
    ? {
        ...session.connection,
        username: null,
        password: null,
        command: null
      }
    : null

  const serviceRoutes = (session.serviceRoutes ?? []).map((route) =>
    route.showCredentials === false
      ? { ...route, hint: route.hint }
      : route
  )

  return redactDesktopViewerFromSession({
    ...session,
    accessMode: ACCESS_MODE.DISCOVER,
    securitySimulation: true,
    credentials,
    connection,
    connectionRoutes,
    serviceRoutes
  })
}

/**
 * @param {object | null | undefined} lab
 * @param {object[]} portSpecs
 * @param {object[]} mappedPorts
 * @param {object[]} existingRoutes
 */
export function mergeTargetEnumerationServiceRoutes(lab, portSpecs, mappedPorts, existingRoutes = []) {
  const defs = getTargetServiceDefinitions(lab)
  if (!defs.length) return existingRoutes

  const byKey = new Set(
    existingRoutes.map((r) => `${r.purpose}-${r.containerPort}-${r.hostPort}`)
  )
  /** @type {object[]} */
  const merged = [...existingRoutes]

  for (const svc of defs) {
    if (svc.showToUser === false) continue
    const containerPort = Number(svc.port ?? svc.containerPort ?? 0)
    if (!containerPort) continue

    const purpose = normalizeServicePurpose(svc.purpose, containerPort)
    const label = svc.label ?? defaultServiceLabel(purpose)
    const hostAlias = svc.host ?? SANDBOX_SSH_TARGET

    const spec = portSpecs.find(
      (p) => (p.containerPort ?? p.container) === containerPort
    )
    const mapping = mappedPorts.find(
      (p) => (p.containerPort ?? p.container) === containerPort
    )
    const hostPort = Number(mapping?.hostPort ?? mapping?.host ?? 0) || 0
    const exposeToHost = spec?.exposeToHost === true && hostPort > 0

    const host = exposeToHost ? DEFAULT_LOOPBACK_HOST : hostAlias
    const displayPort = exposeToHost ? hostPort : containerPort
    const url =
      purpose === 'ssh'
        ? null
        : buildServiceAccessUrl(purpose, host, displayPort)

    const accessLabel =
      purpose === 'ssh'
        ? `SSH available at ${host}:${displayPort}`
        : url ?? `${label} available at ${host}:${displayPort}`

    const route = {
      id: `target-${purpose}-${containerPort}`,
      purpose,
      label,
      hint: svc.hint ?? '',
      spoilLevel: svc.spoilLevel ?? 'low',
      host,
      hostPort: displayPort,
      containerPort,
      protocol: svc.protocol ?? 'tcp',
      url,
      accessLabel,
      status: hostPort > 0 || !exposeToHost ? 'starting' : 'offline',
      httpStatus: null,
      showToUser: true,
      showCredentials: svc.showCredentials === true
    }

    const key = `${route.purpose}-${route.containerPort}-${route.hostPort}`
    if (!byKey.has(key)) {
      byKey.add(key)
      merged.push(route)
    }
  }

  return merged
}

/**
 * Default workstation recommendation order for security simulation labs.
 */
export const SECURITY_WORKSTATION_PREFERENCE_ORDER = [
  'desktop-container-kali',
  'kali-terminal',
  'ubuntu-terminal',
  'debian-terminal'
]

/**
 * @param {object | null | undefined} lab
 * @param {object} capabilities
 */
export function resolveSecuritySimulationWorkstationRecommendation(lab, capabilities) {
  const explicit = lab?.workstation?.recommended
  if (explicit && explicit !== 'auto') return explicit

  const supported = new Set(lab?.workstation?.supported ?? [])
  const restrict = lab?.workstation?.restrictToSupported === true

  for (const id of SECURITY_WORKSTATION_PREFERENCE_ORDER) {
    if (restrict && supported.size > 0 && !supported.has(id)) continue
    if (id === 'desktop-container-kali') {
      const profile = capabilities?.profiles?.[id]
      if (profile?.available) return id
      continue
    }
    if (id === 'kali-terminal') {
      if (capabilities?.dockerLinuxContainers) return id
      continue
    }
    if (capabilities?.dockerLinuxContainers) return id
  }
  return lab?.workstation?.recommended ?? 'ubuntu-terminal'
}

/**
 * @param {object | null | undefined} objective
 */
export function isObtainSshAccessObjective(objective) {
  return (
    objective?.securityType === 'obtainSshAccess' ||
    objective?.autoCheck === 'obtainSshAccess'
  )
}

/**
 * @param {object | null | undefined} objective
 */
export function shouldSkipAutoCheckForSecurityObjective(objective) {
  if (!objective) return false
  if (isObtainSshAccessObjective(objective)) return true
  const securityType = objective.securityType ?? objective.autoCheck
  if (SECURITY_OBJECTIVE_TYPES.includes(securityType) && securityType !== 'enumeratePorts') {
    return ['findUsername', 'findPassword', 'obtainSshAccess', 'findUserFlag', 'privilegeEscalation', 'findRootFlag', 'submitFlag', 'answerQuestion'].includes(
      securityType
    )
  }
  return false
}

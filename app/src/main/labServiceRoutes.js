/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import net from 'net'
import http from 'http'
import https from 'https'
import { DEFAULT_LOOPBACK_HOST, SANDBOX_SSH_TARGET } from './labPorts.js'

/** @typedef {'ssh' | 'web' | 'api' | 'database' | 'custom' | 'http' | 'https'} ServicePurpose */

/**
 * @param {string | undefined} purpose
 * @param {number} container
 * @returns {ServicePurpose | string}
 */
export function normalizeServicePurpose(purpose, container) {
  const p = String(purpose ?? '').toLowerCase()
  if (p === 'http' || p === 'https') return 'web'
  if (p === 'ssh' || p === 'web' || p === 'api' || p === 'database' || p === 'custom') return p
  if (container === 22) return 'ssh'
  if (container === 80 || container === 8080) return 'web'
  if (container === 443) return 'web'
  return p || 'custom'
}

/**
 * @param {ServicePurpose | string} purpose
 */
export function defaultServiceLabel(purpose) {
  switch (purpose) {
    case 'web':
    case 'http':
    case 'https':
      return 'Web Service'
    case 'api':
      return 'API Endpoint'
    case 'database':
      return 'Database'
    case 'ssh':
      return 'SSH'
    default:
      return 'Service'
  }
}

/**
 * @param {ServicePurpose | string} purpose
 * @param {string} host
 * @param {number} port
 */
export function buildServiceAccessUrl(purpose, host, port) {
  if (!host || !port) return null
  const p = normalizeServicePurpose(purpose, port)
  if (p === 'database') return null
  if (p === 'ssh') return null
  const scheme = purpose === 'https' || port === 443 ? 'https' : 'http'
  return `${scheme}://${host}:${port}`
}

/**
 * @param {ReturnType<import('./labPorts.js').normalizeLabPortDefinitions>[number]} spec
 * @param {{ container?: number, containerPort?: number, host?: number, hostPort?: number, hostIp?: string } | undefined} mapping
 */
export function buildServiceRouteFromSpec(spec, mapping) {
  const purpose = normalizeServicePurpose(spec.purpose, spec.container)
  const host = mapping?.hostIp ?? DEFAULT_LOOPBACK_HOST
  const hostPort = Number(mapping?.hostPort ?? mapping?.host ?? 0) || 0
  const routeId =
    purpose === 'custom' ? `custom-${spec.container}` : String(purpose)

  return {
    id: routeId,
    purpose,
    label: spec.label ?? defaultServiceLabel(purpose),
    hint: spec.hint ?? '',
    spoilLevel: spec.spoilLevel ?? 'low',
    host,
    hostPort,
    containerPort: spec.container,
    protocol: spec.protocol ?? 'tcp',
    url: buildServiceAccessUrl(purpose, host, hostPort),
    accessLabel:
      purpose === 'database'
        ? `${host}:${hostPort}`
        : buildServiceAccessUrl(purpose, host, hostPort),
    status: hostPort > 0 ? 'starting' : 'offline',
    httpStatus: null,
    showToUser: spec.showToUser !== false,
    showCredentials: spec.showCredentials !== false
  }
}

/**
 * @param {ReturnType<import('./labPorts.js').normalizeLabPortDefinitions>} portSpecs
 * @param {object[]} mappedPorts
 */
export function buildServiceRoutes(portSpecs, mappedPorts) {
  /** @type {ReturnType<typeof buildServiceRouteFromSpec>[]} */
  const routes = []

  for (const spec of portSpecs) {
    if (spec.showToUser !== true) continue

    const containerPort = spec.containerPort ?? spec.container
    const isSsh = spec.purpose === 'ssh' || containerPort === 22

    if (isSsh && spec.exposeToHost !== true) {
      if (spec.showCredentials === false) {
        routes.push({
          id: 'ssh',
          purpose: 'ssh',
          label: spec.label ?? defaultServiceLabel('ssh'),
          hint: spec.hint ?? '',
          spoilLevel: spec.spoilLevel ?? 'low',
          host: SANDBOX_SSH_TARGET,
          hostPort: containerPort,
          containerPort,
          protocol: spec.protocol ?? 'tcp',
          url: null,
          accessLabel: `SSH available at ${SANDBOX_SSH_TARGET}:${containerPort}`,
          status: 'starting',
          httpStatus: null,
          showToUser: true,
          showCredentials: false
        })
      }
      continue
    }

    const mapping = mappedPorts.find(
      (p) =>
        (p.containerPort ?? p.container) === spec.container ||
        p.container === spec.container
    )

    if (spec.exposeToHost && (!mapping || !(mapping.hostPort ?? mapping.host))) {
      continue
    }

    routes.push(buildServiceRouteFromSpec(spec, mapping))
  }

  return routes
}

/**
 * @param {string} host
 * @param {number} port
 * @param {number} [timeoutMs]
 */
function tcpProbe(host, port, timeoutMs = 4000) {
  return new Promise((resolve) => {
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
}

/**
 * @param {string} url
 * @param {number} [timeoutMs]
 */
function httpStatusProbe(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      resolve(0)
      return
    }
    const lib = parsed.protocol === 'https:' ? https : http
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname || '/',
        method: 'GET',
        timeout: timeoutMs
      },
      (res) => {
        res.resume()
        resolve(res.statusCode ?? 0)
      }
    )
    req.on('timeout', () => {
      req.destroy()
      resolve(0)
    })
    req.on('error', () => resolve(0))
    req.end()
  })
}

/**
 * @param {ReturnType<typeof buildServiceRouteFromSpec>} route
 */
export async function probeServiceRouteStatus(route) {
  if (!route.hostPort) {
    return { ...route, status: 'offline', httpStatus: null }
  }

  const purpose = normalizeServicePurpose(route.purpose, route.containerPort)

  if (purpose === 'web' || purpose === 'api' || purpose === 'http' || purpose === 'https') {
    const url = route.url ?? buildServiceAccessUrl(purpose, route.host, route.hostPort)
    if (!url) {
      const open = await tcpProbe(route.host, route.hostPort)
      return { ...route, status: open ? 'online' : 'offline', httpStatus: null }
    }
    const code = await httpStatusProbe(url)
    if (code > 0) {
      return { ...route, status: 'online', httpStatus: code }
    }
    const open = await tcpProbe(route.host, route.hostPort)
    return { ...route, status: open ? 'starting' : 'offline', httpStatus: null }
  }

  const open = await tcpProbe(route.host, route.hostPort)
  return { ...route, status: open ? 'online' : 'offline', httpStatus: null }
}

/**
 * @param {ReturnType<typeof buildServiceRouteFromSpec>[]} routes
 */
export async function probeAllServiceRoutes(routes) {
  return Promise.all(routes.map((route) => probeServiceRouteStatus(route)))
}

/**
 * @param {ReturnType<import('./labPorts.js').normalizeLabPortDefinitions>} portSpecs
 * @param {object[]} mappedPorts
 */
export function enrichPortMappings(portSpecs, mappedPorts) {
  return mappedPorts.map((mapping) => {
    const containerPort = mapping.containerPort ?? mapping.container
    const spec = portSpecs.find((s) => s.container === containerPort)
    if (!spec) return mapping
    return {
      ...mapping,
      purpose: spec.purpose,
      label: spec.label,
      hint: spec.hint,
      showToUser: spec.showToUser,
      exposeToHost: spec.exposeToHost,
      spoilLevel: spec.spoilLevel
    }
  })
}

/**
 * @param {string} serviceRef
 * @param {ReturnType<typeof buildServiceRouteFromSpec>[]} routes
 */
export function findServiceRouteByRef(serviceRef, routes) {
  if (!serviceRef) return null
  const ref = String(serviceRef).toLowerCase()
  return (
    routes.find((r) => r.id === ref) ??
    routes.find((r) => r.purpose === ref) ??
    routes.find((r) => r.label?.toLowerCase().includes(ref)) ??
    null
  )
}

/**
 * @param {string | undefined} serviceRef
 * @param {ReturnType<typeof buildServiceRouteFromSpec>[]} routes
 */
export function serviceRefHintText(serviceRef, routes) {
  const route = findServiceRouteByRef(serviceRef, routes)
  if (!route) return 'Use the service route listed below.'
  return `Use the ${route.label} route listed below.`
}

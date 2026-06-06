/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as dockerManager from '../dockerManager.js'
import { isWslDockerKvmRuntime, resolveDesktopViewerUrl } from '../wsl/wslDockerKvm.js'
import { getWorkstationDesktopConfig } from './workstationDesktopConfig.js'

export const WORKSTATION_LOOPBACK_HOST = '127.0.0.1'

/** Container ports commonly used by dockur/windows and similar desktop images. */
const KNOWN_CONTAINER_PORTS = {
  novnc: [8006, 3000],
  rdp: [3389],
  vnc: [5900, 3001]
}

/**
 * @param {number} containerPort
 * @returns {'desktop-web' | 'desktop-rdp' | 'desktop-vnc' | undefined}
 */
function purposeFromContainerPort(containerPort) {
  if (KNOWN_CONTAINER_PORTS.novnc.includes(containerPort)) return 'desktop-web'
  if (KNOWN_CONTAINER_PORTS.rdp.includes(containerPort)) return 'desktop-rdp'
  if (KNOWN_CONTAINER_PORTS.vnc.includes(containerPort)) return 'desktop-vnc'
  return undefined
}

/**
 * @param {{ container: number, protocol?: string, host?: number, hostPort?: number, hostIp?: string, purpose?: string }[]} mappings
 * @param {number} [webViewerPort]
 */
export function buildWorkstationAccessRoutesFromMappings(mappings, webViewerPort) {
  const defaultWebPort = webViewerPort ?? getWorkstationDesktopConfig().webViewerPort
  const normalized = (mappings ?? []).map((m) => ({
    container: Number(m.container),
    protocol: m.protocol ?? 'tcp',
    host: Number(m.host ?? m.hostPort ?? 0),
    hostIp: normalizeLoopbackHost(m.hostIp),
    purpose: m.purpose ?? purposeFromContainerPort(Number(m.container))
  }))

  /** @type {object[]} */
  const routes = []

  const pick = (purpose, containerPorts) =>
    normalized.find((m) => m.purpose === purpose && m.host > 0) ??
    normalized.find((m) => containerPorts.includes(m.container) && m.host > 0) ??
    null

  const novnc = pick('desktop-web', KNOWN_CONTAINER_PORTS.novnc)
  if (novnc) {
    const url =
      resolveDesktopViewerUrl(novnc) ??
      `http://${WORKSTATION_LOOPBACK_HOST}:${novnc.host}/`
    routes.push({
      type: 'novnc',
      label: 'Browser Desktop',
      url,
      host: WORKSTATION_LOOPBACK_HOST,
      port: novnc.host,
      containerPort: novnc.container || defaultWebPort,
      showToUser: true
    })
  }

  const rdp = pick('desktop-rdp', KNOWN_CONTAINER_PORTS.rdp)
  if (rdp) {
    routes.push({
      type: 'rdp',
      label: 'RDP',
      host: WORKSTATION_LOOPBACK_HOST,
      port: rdp.host,
      containerPort: rdp.container,
      showToUser: true
    })
  }

  const vnc = pick('desktop-vnc', KNOWN_CONTAINER_PORTS.vnc)
  if (vnc) {
    routes.push({
      type: 'vnc',
      label: 'VNC',
      host: WORKSTATION_LOOPBACK_HOST,
      port: vnc.host,
      containerPort: vnc.container,
      showToUser: false
    })
  }

  return routes
}

/**
 * @param {string | null | undefined} hostIp
 */
function normalizeLoopbackHost(hostIp) {
  if (!hostIp || hostIp === '0.0.0.0') return WORKSTATION_LOOPBACK_HOST
  return hostIp
}

/**
 * Inspect a running workstation container and derive user-facing access routes.
 * All published viewer ports are normalized to 127.0.0.1 in route payloads.
 *
 * @param {string} containerId
 * @param {{ dockerRuntime?: string | null, webViewerPort?: number }} [options]
 */
export async function inspectWorkstationAccessRoutes(containerId, options = {}) {
  if (!containerId) return []
  const dockerOpts = isWslDockerKvmRuntime(options.dockerRuntime)
    ? { runtime: options.dockerRuntime }
    : {}
  const discovered = await dockerManager.inspectContainerPublishedPorts(containerId, dockerOpts)
  const mappings = discovered.map((p) => ({
    container: p.container,
    protocol: p.protocol,
    host: p.host,
    hostIp: WORKSTATION_LOOPBACK_HOST,
    purpose: purposeFromContainerPort(p.container)
  }))
  return buildWorkstationAccessRoutesFromMappings(mappings, options.webViewerPort)
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  buildInternalLabConnection,
  buildInternalSshCommand,
  DEFAULT_LOOPBACK_HOST,
  findSshPortMapping,
  INTERNAL_SSH_CONTAINER_PORT,
  SANDBOX_SSH_TARGET,
  VBOX_NAT_GATEWAY_HOST
} from './labPorts.js'

/**
 * @typedef {'labTerminal' | 'vmWorkstation' | 'hostPc' | 'desktopFallback'} ConnectionContext
 */

/**
 * @param {string} username
 * @param {string} host
 * @param {number} port
 */
function buildSshCommand(username, host, port) {
  if (!username || !host) return null
  if (port === INTERNAL_SSH_CONTAINER_PORT) {
    return buildInternalSshCommand(username, host, port)
  }
  return `ssh ${username}@${host} -p ${port}`
}

/**
 * @param {object} params
 * @param {object} params.credentials
 * @param {{ host: string, port: number, internalIp?: string | null } | null} [params.internalRoute]
 * @param {object[]} [params.ports]
 * @param {boolean} [params.isVmWorkstation]
 * @param {boolean} [params.isDesktopWorkstation]
 * @param {boolean} [params.isWindowsDesktopWorkstation]
 * @param {boolean} [params.isLocalTerminal]
 * @param {boolean} [params.isWslLocalTerminal]
 * @param {'provided' | 'discover'} [params.accessMode]
 * @param {boolean} [params.hideCredentials]
 */
export function buildLabConnectionRoutes(params) {
  const {
    credentials,
    internalRoute,
    ports = [],
    isVmWorkstation = false,
    isDesktopWorkstation = false,
    isWindowsDesktopWorkstation = false,
    isLocalTerminal = false,
    isWslLocalTerminal = false,
    accessMode = 'provided',
    hideCredentials = false
  } = params
  const discoverMode = accessMode === 'discover' || hideCredentials === true
  const hostOnlyWorkstation = isLocalTerminal || isWslLocalTerminal
  const username = credentials?.username ?? ''
  const password = credentials?.password ?? ''
  const sshMapping = findSshPortMapping(ports)
  const hostPublishedPort =
    Number(sshMapping?.hostPort ?? sshMapping?.host ?? 0) > 0
      ? Number(sshMapping.hostPort ?? sshMapping.host)
      : null

  /** @type {object[]} */
  const routes = []

  const internalIp =
    internalRoute?.internalIp ?? credentials?.targetInternalIp ?? null
  const internalHost =
    (typeof internalIp === 'string' && internalIp.trim() ? internalIp.trim() : null) ??
    internalRoute?.host ??
    SANDBOX_SSH_TARGET
  const networkAlias =
    internalRoute?.networkAlias ??
    (internalIp && internalHost !== SANDBOX_SSH_TARGET ? SANDBOX_SSH_TARGET : null)
  const internalPort =
    Number(internalRoute?.port ?? credentials?.sshPort ?? INTERNAL_SSH_CONTAINER_PORT) ||
    INTERNAL_SSH_CONTAINER_PORT

  if (!isVmWorkstation && !hostOnlyWorkstation && internalHost) {
    routes.push({
      context: 'labTerminal',
      label: isDesktopWorkstation
        ? isWindowsDesktopWorkstation
          ? 'From Windows Desktop'
          : 'From Desktop Workstation'
        : 'From Lab Terminal',
      host: internalHost,
      port: internalPort,
      protocol: 'ssh',
      showCredentials: !discoverMode,
      internalIp: internalIp ?? null,
      networkAlias,
      ...(isWindowsDesktopWorkstation
        ? {
            hint: internalIp
              ? 'Try the private session IP first. If SSH fails inside the Windows guest, use the fallback route below.'
              : 'Inside the Windows desktop, use the fallback route when the lab target IP is unavailable.'
          }
        : {
            hint: internalIp
              ? 'Private session network address for the lab target container.'
              : undefined
          }),
      ...(discoverMode
        ? {
            accessHint: 'SSH is part of the challenge. Discover valid access before connecting.'
          }
        : {
            username,
            password,
            command: buildSshCommand(username, internalHost, internalPort)
          })
    })
  }

  if (isWindowsDesktopWorkstation && hostPublishedPort) {
    routes.push({
      context: 'desktopFallback',
      label: 'Windows Desktop fallback',
      host: 'host.docker.internal',
      port: hostPublishedPort,
      protocol: 'ssh',
      showCredentials: !discoverMode,
      hint: 'Use this route from inside the Windows desktop when lab-target hostname resolution is unavailable.',
      ...(discoverMode
        ? {}
        : {
            username,
            password,
            command: buildSshCommand(username, 'host.docker.internal', hostPublishedPort)
          })
    })
  }

  if (isVmWorkstation && hostPublishedPort) {
    routes.push({
      context: 'vmWorkstation',
      label: 'From VM Workstation',
      host: VBOX_NAT_GATEWAY_HOST,
      port: hostPublishedPort,
      protocol: 'ssh',
      showCredentials: !discoverMode,
      hint: 'Inside the VirtualBox guest, use the NAT gateway (10.0.2.2) and the host-published port — not the Docker internal IP.',
      ...(discoverMode
        ? {}
        : {
            username,
            password,
            command: buildSshCommand(username, VBOX_NAT_GATEWAY_HOST, hostPublishedPort)
          })
    })
  }

  if (hostPublishedPort) {
    routes.push({
      context: 'hostPc',
      label: isWslLocalTerminal
        ? 'From WSL (localhost)'
        : isLocalTerminal
          ? 'From Local Terminal (your PC)'
          : 'From Your PC',
      host: DEFAULT_LOOPBACK_HOST,
      port: hostPublishedPort,
      protocol: 'ssh',
      showCredentials: !discoverMode,
      hint: isWslLocalTerminal
        ? 'WSL Local Terminal uses your real WSL distro — use localhost and the published host port only (not Docker internal IPs).'
        : isLocalTerminal
          ? 'Local Terminal Workstation uses your real system — connect with localhost only (not Docker internal IPs).'
          : 'Connect from your computer while the lab is running.',
      ...(discoverMode
        ? {}
        : {
            username,
            password,
            command: buildSshCommand(username, DEFAULT_LOOPBACK_HOST, hostPublishedPort)
          })
    })
  }

  const primary =
    (hostOnlyWorkstation
      ? routes.find((r) => r.context === 'hostPc')
      : isVmWorkstation
        ? routes.find((r) => r.context === 'vmWorkstation')
        : routes.find((r) => r.context === 'labTerminal')) ?? routes[0] ?? null

  const connection = primary
    ? discoverMode
      ? {
          host: primary.host,
          port: primary.port,
          protocol: 'ssh',
          context: primary.context,
          label: primary.label,
          showCredentials: false
        }
      : {
          host: primary.host,
          port: primary.port,
          protocol: 'ssh',
          username,
          password,
          command: primary.command,
          context: primary.context,
          label: primary.label
        }
    : internalHost
      ? discoverMode
        ? {
            host: internalHost,
            port: internalPort,
            protocol: 'ssh',
            showCredentials: false
          }
        : buildInternalLabConnection(username, password, internalHost, internalPort, internalIp)
      : null

  return { routes, connection, hostPublishedPort }
}

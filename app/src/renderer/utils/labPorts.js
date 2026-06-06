/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const INTERNAL_SSH_PORT = 22
export const LAB_TARGET_HOST = 'lab-target'

/**
 * Internal Docker-network SSH endpoint (not published to the host).
 * @param {object | null | undefined} session
 */
export function getInternalSshConnection(session) {
  if (session?.connection?.host) {
    return session.connection
  }
  const host =
    session?.credentials?.targetInternalIp ??
    session?.helper?.targetInternalIp ??
    LAB_TARGET_HOST
  const username = session?.credentials?.username
  if (!username) return null
  return {
    host,
    port: session?.connection?.port ?? session?.credentials?.sshPort ?? INTERNAL_SSH_PORT,
    command: `ssh ${username}@${host}`,
    username,
    password: session?.credentials?.password
  }
}

/**
 * @param {{ purpose?: string, host?: number, hostPort?: number, hostIp?: string, container?: number, containerPort?: number, protocol?: string, internal?: boolean }} port
 */
export function formatPortMappingLabel(port) {
  const purpose = String(port.purpose ?? 'service').toUpperCase()
  const hostPort = port.hostPort ?? port.host ?? 0
  const containerPort = port.containerPort ?? port.container
  const proto = port.protocol ?? 'tcp'
  if (!hostPort || port.internal) {
    return `${purpose.padEnd(8)} container:${containerPort}/${proto} (private lab network only)`
  }
  const hostIp = port.hostIp ?? '127.0.0.1'
  return `${purpose.padEnd(8)} ${hostIp}:${hostPort} -> container:${containerPort}/${proto}`
}

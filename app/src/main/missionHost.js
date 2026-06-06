/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { TERMINAL_SSH_HOST_DOCKER_DESKTOP } from './missionSessionCredentials.js'

/**
 * Hostname helpers use from inside the terminal-helper container to reach published host ports.
 */
export function getDefaultTerminalSshHost() {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    return TERMINAL_SSH_HOST_DOCKER_DESKTOP
  }
  return TERMINAL_SSH_HOST_DOCKER_DESKTOP
}

/**
 * Extra hosts for helper container (`docker run --add-host`).
 */
export function getHelperExtraHosts() {
  return ['host.docker.internal:host-gateway']
}

/**
 * @param {{ loopbackHost: string, loopbackPort: number, terminalHost: string, terminalPort: number, internalHost?: string, internalPort?: number }} params
 */
export function buildConnectionEndpoints(params) {
  const internalHost = params.internalHost ?? 'lab-target'
  const internalPort = params.internalPort ?? 22
  return {
    external: {
      label: 'From your PC',
      host: params.loopbackHost,
      port: params.loopbackPort
    },
    missionTerminal: {
      label: 'From Lab Terminal',
      host: params.terminalHost,
      port: params.terminalPort
    },
    internal: {
      label: 'On lab network',
      host: internalHost,
      port: internalPort
    }
  }
}

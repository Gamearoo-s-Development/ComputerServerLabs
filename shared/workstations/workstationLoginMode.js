/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @typedef {'auto-login' | 'app-gated' | 'tty-login'} WorkstationLoginMode */

export const WORKSTATION_LOGIN_MODES = ['auto-login', 'app-gated', 'tty-login']

export const DEFAULT_WORKSTATION_LOGIN_MODE = 'tty-login'

/** @type {Record<string, WorkstationLoginMode>} */
const LEGACY_LOGIN_MODE_MAP = {
  none: 'auto-login',
  'show-credentials': 'tty-login'
}

/**
 * @param {string | null | undefined} mode
 * @returns {WorkstationLoginMode}
 */
export function normalizeWorkstationLoginMode(mode) {
  if (mode && LEGACY_LOGIN_MODE_MAP[mode]) {
    return LEGACY_LOGIN_MODE_MAP[mode]
  }
  if (WORKSTATION_LOGIN_MODES.includes(mode)) {
    return /** @type {WorkstationLoginMode} */ (mode)
  }
  return DEFAULT_WORKSTATION_LOGIN_MODE
}

/**
 * @param {string | null | undefined} mode
 */
export function isValidWorkstationLoginMode(mode) {
  return WORKSTATION_LOGIN_MODES.includes(mode) || Boolean(mode && LEGACY_LOGIN_MODE_MAP[mode])
}

/**
 * @param {object | null | undefined} settings
 * @param {object | null | undefined} lab
 * @returns {WorkstationLoginMode}
 */
export function resolveWorkstationLoginMode(settings, lab) {
  const labMode = lab?.workstation?.loginMode
  if (isValidWorkstationLoginMode(labMode)) return normalizeWorkstationLoginMode(labMode)
  const setting = settings?.workstationLoginMode
  if (isValidWorkstationLoginMode(setting)) return normalizeWorkstationLoginMode(setting)
  return DEFAULT_WORKSTATION_LOGIN_MODE
}

/**
 * @param {object | null | undefined} workstationCredentials
 */
export function workstationLoginGateRequired(workstationCredentials) {
  if (!workstationCredentials) return false
  const mode = normalizeWorkstationLoginMode(workstationCredentials.loginMode)
  if (mode !== 'app-gated') return false
  return workstationCredentials.loginRequired !== false
}

/**
 * @param {object | null | undefined} workstationCredentials
 */
export function workstationCredentialsVisible(workstationCredentials) {
  if (!workstationCredentials) return false
  const mode = normalizeWorkstationLoginMode(workstationCredentials.loginMode)
  if (mode === 'auto-login') return false
  return workstationCredentials.loginRequired !== false
}

/**
 * @param {object | null | undefined} workstationCredentials
 */
export function workstationTerminalUsesTtyLogin(workstationCredentials) {
  if (!workstationCredentials) return true
  return normalizeWorkstationLoginMode(workstationCredentials.loginMode) === 'tty-login'
}

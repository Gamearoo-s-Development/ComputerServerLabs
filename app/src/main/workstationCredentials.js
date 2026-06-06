/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { generateLabPassword } from './credentialManager.js'
import { generateOperatorUsername } from './operatorUsername.js'
import { sanitizeUnixUser } from './utils/sanitize.js'
import { logger } from './utils/logger.js'
import {
  normalizeWorkstationLoginMode,
  resolveWorkstationLoginMode,
  workstationCredentialsVisible
} from '@sysadmin-game/shared/workstations/workstationLoginMode.js'
import { loadMissionSessionCredentials, persistMissionSessionCredentialsRecord } from './missionSessionCredentials.js'

/**
 * @typedef {object} WorkstationCredentials
 * @property {string} username
 * @property {string} password
 * @property {string} displayName
 * @property {boolean} loginRequired
 * @property {'auto-login' | 'app-gated' | 'tty-login'} loginMode
 * @property {string} accessMethod
 */

/**
 * @param {object} params
 */
export function createWorkstationCredentials(params) {
  const { sessionId, labId, displayName, settings, lab, accessMethod = 'terminal' } = params
  const loginMode = resolveWorkstationLoginMode(settings, lab)
  const username = generateOperatorUsername(`${sessionId}:workstation`)
  const password = generateLabPassword(16)

  /** @type {WorkstationCredentials} */
  const record = {
    username: sanitizeUnixUser(username),
    password,
    displayName: displayName ?? 'Lab Workstation',
    loginRequired: loginMode !== 'auto-login',
    loginMode,
    accessMethod
  }

  logger.info('workstationCredentials', 'Workstation credentials created', {
    sessionId,
    labId,
    username: record.username,
    loginMode: record.loginMode,
    accessMethod: record.accessMethod
  })

  return record
}

/**
 * @param {string} sessionId
 * @param {WorkstationCredentials} workstationCredentials
 */
export function attachWorkstationCredentialsToSessionRecord(sessionId, workstationCredentials) {
  const record = loadMissionSessionCredentials(sessionId)
  if (!record) return null
  record.workstationCredentials = workstationCredentials
  persistMissionSessionCredentialsRecord(record)
  return record
}

/**
 * @param {WorkstationCredentials | null | undefined} workstationCredentials
 */
export function sanitizeWorkstationCredentialsForClient(workstationCredentials) {
  if (!workstationCredentials) return null
  const loginMode = normalizeWorkstationLoginMode(workstationCredentials.loginMode)
  const base = {
    username: workstationCredentials.username,
    displayName: workstationCredentials.displayName ?? 'Lab Workstation',
    loginRequired: workstationCredentials.loginRequired === true,
    loginMode,
    accessMethod: workstationCredentials.accessMethod ?? 'terminal'
  }
  if (!workstationCredentialsVisible(workstationCredentials)) {
    return { ...base, password: null }
  }
  return {
    ...base,
    password: workstationCredentials.password ?? null
  }
}

/**
 * @param {WorkstationCredentials} workstationCredentials
 */
export function workstationCredentialsToEnv(workstationCredentials) {
  return {
    SGQ_USERNAME: workstationCredentials.username,
    SGQ_PASSWORD: workstationCredentials.password,
    LAB_USERNAME: workstationCredentials.username,
    LAB_PASSWORD: workstationCredentials.password,
    SGQ_WORKSTATION_LOGIN_MODE: workstationCredentials.loginMode
  }
}

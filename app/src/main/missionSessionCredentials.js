/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { generateLabPassword } from './credentialManager.js'
import { ensureDataDirectories, getDataLayout } from './dataDirectoryManager.js'
import { logger } from './utils/logger.js'
import { generateOperatorUsername } from './operatorUsername.js'
import { normalizeTargetUser } from './labBuilder/labFilesystem.js'
import { assertSafeSessionId, sanitizeUnixUser } from './utils/sanitize.js'

export const LOOPBACK_SSH_HOST = '127.0.0.1'
export const TERMINAL_SSH_HOST_DOCKER_DESKTOP = 'host.docker.internal'

/**
 * @typedef {object} MissionSessionCredentials
 * @property {string} sessionId
 * @property {string} labId
 * @property {string} username
 * @property {string} password
 * @property {number | null} sshPort
 * @property {string} loopbackHost
 * @property {string | null} terminalSshHost
 * @property {boolean} sshReady
 * @property {boolean} labOnly
 */

/**
 * Single source of truth for mission session identity (created once per mission start).
 * @param {object} lab
 * @param {string} sessionId
 * @returns {MissionSessionCredentials}
 */
export function createMissionSessionCredentials(lab, sessionId) {
  assertSafeSessionId(sessionId)
  ensureDataDirectories()

  const targetUser = normalizeTargetUser(lab)
  if (targetUser.mode === 'root' && !targetUser.allowRoot) {
    throw new Error(
      'Lab declares root login but allowRoot is not enabled. Enable targetUser.allowRoot in lab.json or use generated-user mode.'
    )
  }
  const username = targetUser.mode === 'root' && targetUser.allowRoot ? 'root' : generateOperatorUsername(sessionId)
  const pwdLenRaw = Number(lab.credentials?.passwordLength)
  const pwdLen =
    Number.isFinite(pwdLenRaw) && pwdLenRaw >= 8 && pwdLenRaw <= 128
      ? Math.floor(pwdLenRaw)
      : 16
  const password = generateLabPassword(pwdLen)

  /** @type {MissionSessionCredentials} */
  const record = {
    sessionId,
    labId: lab.id,
    username: sanitizeUnixUser(username),
    password,
    sshPort: null,
    loopbackHost: LOOPBACK_SSH_HOST,
    terminalSshHost: null,
    sshReady: false,
    labOnly: true,
    generatedAt: new Date().toISOString()
  }

  persistMissionSessionCredentials(record)
  logger.info('missionSession', 'Mission session credentials created', {
    sessionId,
    labId: lab.id,
    username: record.username
  })

  return record
}

/**
 * @param {MissionSessionCredentials} record
 */
function persistMissionSessionCredentials(record) {
  const filePath = path.join(getDataLayout().sessions, `${record.sessionId}.json`)
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), { encoding: 'utf8', mode: 0o600 })
}

/**
 * @param {MissionSessionCredentials & { workstationCredentials?: object }} record
 */
export function persistMissionSessionCredentialsRecord(record) {
  persistMissionSessionCredentials(record)
}

/**
 * @param {string} sessionId
 * @returns {MissionSessionCredentials | null}
 */
export function loadMissionSessionCredentials(sessionId) {
  assertSafeSessionId(sessionId)
  const credPath = path.join(getDataLayout().sessions, `${sessionId}.json`)
  if (!fs.existsSync(credPath)) return null
  try {
    return JSON.parse(fs.readFileSync(credPath, 'utf8'))
  } catch {
    return null
  }
}

/**
 * @param {string} sessionId
 * @param {{ sshPort?: number, targetInternalIp?: string, sshReady?: boolean }} update
 */
export function updateMissionSessionCredentials(sessionId, update) {
  const record = loadMissionSessionCredentials(sessionId)
  if (!record) return null
  if (typeof update.sshPort === 'number') record.sshPort = update.sshPort
  if (update.targetInternalIp) {
    record.targetInternalIp = update.targetInternalIp
  }
  if (update.host) {
    record.host = update.host
  }
  if (typeof update.sshReady === 'boolean') record.sshReady = update.sshReady
  persistMissionSessionCredentials(record)
  return record
}

/**
 * Docker env for lab target + helper (never log values).
 * @param {MissionSessionCredentials} creds
 */
export function missionCredentialsToEnv(creds) {
  return {
    SGQ_USERNAME: creds.username,
    SGQ_PASSWORD: creds.password,
    LAB_USERNAME: creds.username,
    LAB_PASSWORD: creds.password
  }
}

/**
 * @param {string} sessionId
 */
export function deleteMissionSessionCredentials(sessionId) {
  assertSafeSessionId(sessionId)
  const filePath = path.join(getDataLayout().sessions, `${sessionId}.json`)
  try {
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true })
  } catch {
    // ignore
  }
}

/**
 * @param {string} sessionId
 */
export function redactMissionCredentialsForClient(sessionId) {
  const record = loadMissionSessionCredentials(sessionId)
  if (!record) return null
  return {
    username: record.username,
    password: record.password,
    host: record.loopbackHost ?? LOOPBACK_SSH_HOST,
    sshPort: record.sshPort,
    terminalSshHost: record.terminalSshHost,
    sshReady: record.sshReady === true,
    labOnly: true
  }
}

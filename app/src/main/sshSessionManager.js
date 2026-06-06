/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { spawnSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { ensureDataDirectories, getDataLayout } from './dataDirectoryManager.js'
import { logger } from './utils/logger.js'
import { assertSafeSessionId } from './utils/sanitize.js'

/**
 * @returns {{ publicKey: string, privateKey: string }}
 */
export function generateEd25519KeyPair() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgq-ssh-'))
  const keyPath = path.join(tmp, 'lab_session_key')
  try {
    const result = spawnSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-f', keyPath, '-q'], {
      encoding: 'utf8',
      windowsHide: true
    })
    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || result.stdout?.trim() || 'ssh-keygen failed')
    }
    const privateKey = fs.readFileSync(keyPath, 'utf8')
    const publicKey = fs.readFileSync(`${keyPath}.pub`, 'utf8').trim()
    return { publicKey, privateKey }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/**
 * @param {string} sessionId
 * @returns {{ publicKey: string, privateKey: string }}
 */
export function generateSessionAccessToken() {
  return crypto.randomBytes(24).toString('hex')
}

/**
 * @param {string} sessionId
 * @returns {{ publicKey: string, privateKey: string, accessToken: string }}
 */
export function createSessionSshKeys(sessionId) {
  assertSafeSessionId(sessionId)
  ensureDataDirectories()
  const keys = generateEd25519KeyPair()
  const accessToken = generateSessionAccessToken()
  const filePath = path.join(getDataLayout().sessions, `${sessionId}.ssh.json`)
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        sessionId,
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
        accessToken,
        generatedAt: new Date().toISOString()
      },
      null,
      2
    ),
    { encoding: 'utf8', mode: 0o600 }
  )
  logger.info('sshSession', 'Session SSH keypair generated', { sessionId })
  return { ...keys, accessToken }
}

/**
 * @param {string} sessionId
 */
export function deleteSessionSshKeys(sessionId) {
  assertSafeSessionId(sessionId)
  const filePath = path.join(getDataLayout().sessions, `${sessionId}.ssh.json`)
  try {
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true })
  } catch {
    // ignore
  }
}

/**
 * @returns {number}
 */
export function deleteAllSessionSshKeys() {
  ensureDataDirectories()
  const dir = getDataLayout().sessions
  if (!fs.existsSync(dir)) return 0
  let removed = 0
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.ssh.json')) continue
    try {
      fs.rmSync(path.join(dir, file), { force: true })
      removed += 1
    } catch {
      // ignore
    }
  }
  return removed
}

/**
 * @param {{ username: string, password?: string, targetInternalIp?: string, workstationProfile?: object }} params
 */
export function buildHelperSshEnv({
  username,
  password,
  targetInternalIp,
  targetHost,
  targetSshPort,
  workstationProfile
}) {
  const isWindows = workstationProfile?.type === 'windows'
  const shell =
    workstationProfile?.terminalShell ??
    (isWindows
      ? 'powershell.exe'
      : workstationProfile?.defaultShell === 'bash'
        ? '/bin/bash'
        : '/bin/sh')

  /** @type {Record<string, string>} */
  const env = {
    SGQ_USERNAME: username,
    LAB_USERNAME: username,
    LAB_HOSTNAME: 'lab-workstation',
    SGQ_TARGET_INTERNAL_IP: targetInternalIp ?? '',
    SGQ_WORKSTATION_LABEL: workstationProfile?.name ?? 'Lab Workstation',
    SGQ_WORKSTATION_DISTRO: workstationProfile?.distro
      ? `${workstationProfile.distro}${workstationProfile.distroVersion ? ` ${workstationProfile.distroVersion}` : ''}`
      : isWindows
        ? 'Windows'
        : 'Linux',
    SGQ_WORKSTATION_SHELL: shell,
    SGQ_WORKSTATION_PROFILE_ID: workstationProfile?.id ?? 'ubuntu-terminal',
    SGQ_TARGET_HOST: targetHost ?? 'lab-target',
    TARGET_HOST: targetHost ?? 'lab-target',
    TARGET_IP: targetInternalIp ?? '',
    SGQ_TARGET_INTERNAL_IP: targetInternalIp ?? '',
    TARGET_SSH_PORT: String(targetSshPort ?? 22),
    SGQ_TARGET_SSH_PORT: String(targetSshPort ?? 22)
  }

  if (password) {
    env.SGQ_PASSWORD = password
    env.LAB_PASSWORD = password
  }

  return env
}

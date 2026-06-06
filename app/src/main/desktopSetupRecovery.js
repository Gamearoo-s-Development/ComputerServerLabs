/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { ensureDataDirectories, getDataLayout } from './dataDirectoryManager.js'
import * as dockerManager from './dockerManager.js'
import { ROLE_DESKTOP } from './labResourceLabels.js'
import { loadMissionSessionCredentials } from './missionSessionCredentials.js'
import { assertSafeSessionId } from './utils/sanitize.js'
import { logger } from './utils/logger.js'

const RECOVERY_SUFFIX = '.desktop-recovery.json'

/**
 * @param {string} sessionId
 */
function recoveryPath(sessionId) {
  assertSafeSessionId(sessionId)
  return path.join(getDataLayout().sessions, `${sessionId}${RECOVERY_SUFFIX}`)
}

/**
 * @param {string} sessionId
 * @param {object} snapshot
 */
export function saveDesktopRecoverySnapshot(sessionId, snapshot) {
  assertSafeSessionId(sessionId)
  ensureDataDirectories()
  const filePath = recoveryPath(sessionId)
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        ...snapshot,
        sessionId,
        savedAt: new Date().toISOString()
      },
      null,
      2
    ),
    { encoding: 'utf8', mode: 0o600 }
  )
  logger.info('desktopRecovery', 'Saved desktop setup recovery snapshot', { sessionId, labId: snapshot.labId })
}

/**
 * @param {string} sessionId
 */
export function loadDesktopRecoverySnapshot(sessionId) {
  assertSafeSessionId(sessionId)
  const filePath = recoveryPath(sessionId)
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

/**
 * @param {string} sessionId
 */
export function clearDesktopRecoverySnapshot(sessionId) {
  assertSafeSessionId(sessionId)
  const filePath = recoveryPath(sessionId)
  try {
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true })
  } catch {
    // ignore
  }
}

/**
 * @returns {string[]}
 */
export function listDesktopRecoverySessionIds() {
  ensureDataDirectories()
  const dir = getDataLayout().sessions
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(RECOVERY_SUFFIX))
    .map((name) => name.slice(0, -RECOVERY_SUFFIX.length))
}

/**
 * @returns {Promise<{ sessionId: string, labId: string, helperContainerId: string, readinessStartedAt?: number, workstationProfileName?: string }[]>}
 */
export async function scanRecoverableDesktopSetups() {
  const ids = listDesktopRecoverySessionIds()
  if (ids.length === 0) return []

  /** @type {{ sessionId: string, labId: string, helperContainerId: string, readinessStartedAt?: number, workstationProfileName?: string }[]} */
  const recoverable = []

  for (const sessionId of ids) {
    const snapshot = loadDesktopRecoverySnapshot(sessionId)
    if (!snapshot?.helperContainerId || !snapshot.labId) continue

    const credentials = loadMissionSessionCredentials(sessionId)
    if (!credentials) continue

    const dockerOpts = snapshot.dockerRuntime ? { runtime: snapshot.dockerRuntime } : {}
    const state = await dockerManager.inspectContainerState(snapshot.helperContainerId, dockerOpts).catch(() => null)
    if (!state?.running) continue

    recoverable.push({
      sessionId,
      labId: snapshot.labId,
      helperContainerId: snapshot.helperContainerId,
      readinessStartedAt: snapshot.readinessStartedAt,
      workstationProfileName: snapshot.workstationProfileName ?? 'Desktop workstation'
    })
  }

  return recoverable
}

/**
 * @returns {Promise<string[]>}
 */
export async function listRecoverableDesktopSessionIds() {
  const rows = await scanRecoverableDesktopSetups()
  return rows.map((row) => row.sessionId)
}

/**
 * Find in-progress desktop container without a snapshot (legacy).
 * @returns {Promise<{ sessionId: string, containerName: string, labId?: string }[]>}
 */
export async function scanOrphanDesktopContainers() {
  const readiness = await dockerManager.checkReady()
  if (!readiness.ready) return []

  const containers = await dockerManager.listSgqContainers({ includeLegacy: true })
  /** @type {{ sessionId: string, containerName: string, labId?: string }[]} */
  const orphans = []

  for (const container of containers) {
    if (container.role !== ROLE_DESKTOP && container.labels?.['sgq.role'] !== ROLE_DESKTOP) continue
    if (!container.sessionId) continue
    if (loadDesktopRecoverySnapshot(container.sessionId)) continue
    const state = await dockerManager.inspectContainerState(container.name).catch(() => null)
    if (!state?.running) continue
    if (!loadMissionSessionCredentials(container.sessionId)) continue
    orphans.push({
      sessionId: container.sessionId,
      containerName: container.name,
      labId: container.labId
    })
  }

  return orphans
}

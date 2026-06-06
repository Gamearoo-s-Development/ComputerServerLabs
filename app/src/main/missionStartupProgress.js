/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @type {Record<string, { label: string, percent: number }>} */
export const MISSION_STARTUP_STEPS = {
  prepare: { label: 'Preparing lab session…', percent: 5 },
  credentials: { label: 'Issuing lab credentials…', percent: 12 },
  network: { label: 'Verifying lab network…', percent: 18 },
  build_image: { label: 'Staging lab assets…', percent: 28 },
  start_target: { label: 'Deploying lab target…', percent: 42 },
  apply_credentials: { label: 'Provisioning user identity…', percent: 50 },
  start_sshd: { label: 'Starting SSH service…', percent: 55 },
  inspect_ports: { label: 'Verifying lab routes…', percent: 60 },
  start_helper: { label: 'Starting lab workstation…', percent: 72 },
  start_workstation: { label: 'Starting lab workstation…', percent: 72 },
  build_helper_image: { label: 'Building lab workstation image…', percent: 68 },
  build_workstation: { label: 'Building lab workstation image…', percent: 68 },
  desktop_readiness: { label: 'Preparing desktop workstation…', percent: 88 },
  ssh_ready: { label: 'Checking SSH reachability…', percent: 85 },
  objectives: { label: 'Loading lab objectives…', percent: 94 },
  ready: { label: 'Lab ready.', percent: 100 }
}

export class MissionStartCancelledError extends Error {
  constructor() {
    super('Lab start canceled')
    this.name = 'MissionStartCancelledError'
    this.code = 'MISSION_START_CANCELED'
  }
}

/** @type {Map<string, { cancelled: boolean, webContents: import('electron').WebContents | null }>} */
const activeStartups = new Map()

/**
 * @param {import('electron').WebContents} webContents
 * @param {string} sessionId
 */
export function createMissionStartupProgress(webContents, sessionId) {
  /** @type {import('electron').WebContents | null} */
  const sender = webContents

  const ctx = {
    sessionId,
    cancelled: false,
    lastStep: 'prepare',
    /**
     * @param {string} step
     * @param {{ status?: 'pending'|'running'|'success'|'warning'|'error', message?: string, percent?: number }} [opts]
     */
    emit(step, opts = {}) {
      const status = opts.status ?? 'running'
      if (status === 'running') {
        ctx.lastStep = step
      }
      const def = MISSION_STARTUP_STEPS[step] ?? { label: step, percent: opts.percent ?? 0 }
      const payload = {
        sessionId,
        step,
        message: opts.message ?? def.label,
        percent: opts.percent ?? def.percent,
        status,
        at: new Date().toISOString(),
        ...(opts.readinessState ? { readinessState: opts.readinessState } : {}),
        ...(opts.desktopUrl ? { desktopUrl: opts.desktopUrl } : {}),
        ...(opts.viewerHttpOk === true ? { viewerHttpOk: true } : {}),
        ...(opts.windowsInstalling === true ? { windowsInstalling: true } : {}),
        ...(Array.isArray(opts.setupLogTail) && opts.setupLogTail.length > 0
          ? { setupLogTail: opts.setupLogTail }
          : {})
      }
      if (sender && !sender.isDestroyed()) {
        sender.send('mission:start-progress', payload)
      }
      return payload
    },
    checkCancel() {
      const active = activeStartups.get(sessionId)
      if (ctx.cancelled || active?.cancelled) {
        throw new MissionStartCancelledError()
      }
    }
  }

  activeStartups.set(sessionId, { cancelled: false, webContents: sender })
  return ctx
}

/**
 * @param {string} sessionId
 */
export function cancelMissionStartup(sessionId) {
  const entry = activeStartups.get(sessionId)
  if (entry) {
    entry.cancelled = true
    return true
  }
  return false
}

/**
 * @param {string} sessionId
 */
export function unregisterMissionStartup(sessionId) {
  activeStartups.delete(sessionId)
}

/**
 * @param {string} sessionId
 */
export function isMissionStartupCancelled(sessionId) {
  return activeStartups.get(sessionId)?.cancelled === true
}

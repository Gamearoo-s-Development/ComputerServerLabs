/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import http from 'http'
import https from 'https'
import net from 'net'
import * as dockerManager from '../dockerManager.js'
import { isWslDockerKvmRuntime } from '../wsl/wslDockerKvm.js'
import { isDesktopContainerProfile } from './workstationDesktopDiagnostics.js'
import { inspectWorkstationAccessRoutes } from './workstationAccessRoutes.js'
import { resolveDesktopWorkstationProfile } from './workstationDesktopConfig.js'
import { isDesktopOnlyWorkstationProfile } from './workstationDesktopSession.js'
import { WorkstationStartError } from './workstationStartError.js'
import {
  registerDesktopReadinessWait,
  unregisterDesktopReadinessWait,
  isDesktopReadinessForced
} from './desktopReadinessControl.js'
import {
  DESKTOP_READINESS_STATE,
  SETUP_PHASE_STATES,
  classifyReadinessFromLogs,
  evaluateLinuxDesktopReady,
  evaluateWindowsDesktopReady,
  formatDesktopSetupLogTail,
  isDesktopReadinessComplete
} from '@sysadmin-game/shared/workstations/desktopReadinessLogic.js'

export {
  DESKTOP_READINESS_STATE,
  classifyReadinessFromLogs,
  isDesktopReadinessComplete
} from '@sysadmin-game/shared/workstations/desktopReadinessLogic.js'
export {
  registerDesktopReadinessWait,
  unregisterDesktopReadinessWait
} from './desktopReadinessControl.js'

/** @deprecated Use DESKTOP_READINESS_STATE */
export const WORKSTATION_READINESS_STATE = {
  DOWNLOADING_IMAGE: DESKTOP_READINESS_STATE.PULLING_IMAGE,
  DOWNLOADING_OS: DESKTOP_READINESS_STATE.DOWNLOADING_OS,
  INSTALLING_OS: DESKTOP_READINESS_STATE.INSTALLING_OS,
  BOOTING: DESKTOP_READINESS_STATE.BOOTING,
  VIEWER_STARTING: DESKTOP_READINESS_STATE.VIEWER_STARTING,
  READY: DESKTOP_READINESS_STATE.DESKTOP_READY,
  FAILED: DESKTOP_READINESS_STATE.FAILED
}

/** @type {Record<string, string>} */
export const READINESS_DISPLAY_MESSAGES = {
  [DESKTOP_READINESS_STATE.PULLING_IMAGE]: 'Pulling desktop image…',
  [DESKTOP_READINESS_STATE.DOWNLOADING_OS]: 'Downloading Windows…',
  [DESKTOP_READINESS_STATE.CREATING_DISK]: 'Creating VM disk…',
  [DESKTOP_READINESS_STATE.INSTALLING_OS]: 'Installing Windows…',
  [DESKTOP_READINESS_STATE.FIRST_BOOT]: 'Performing first boot…',
  [DESKTOP_READINESS_STATE.BOOTING]: 'Booting desktop workstation…',
  [DESKTOP_READINESS_STATE.VIEWER_STARTING]: 'Starting desktop viewer…',
  [DESKTOP_READINESS_STATE.VIEWER_AVAILABLE]: 'Desktop viewer is available — Windows may still be installing.',
  [DESKTOP_READINESS_STATE.LOGIN_SCREEN]: 'Windows login screen detected.',
  [DESKTOP_READINESS_STATE.DESKTOP_READY]: 'Desktop workstation ready',
  [DESKTOP_READINESS_STATE.FAILED]: 'Desktop workstation failed'
}

export const WINDOWS_INSTALLING_NOTE =
  'This can take a while on first setup. Keep this window open. The lab timer has not started.'

export const FIRST_SETUP_NOTE =
  'This can take a while on first setup. Keep this window open. The lab timer has not started.'

const POLL_INTERVAL_MS = 3000
const MAX_VIEWER_HTML_BYTES = 96_000

/**
 * @param {string} host
 * @param {number} port
 * @param {number} [timeoutMs]
 */
function tcpProbe(host, port, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: timeoutMs }, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

/**
 * @param {string} url
 */
function fetchViewerPage(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url)
      const lib = parsed.protocol === 'https:' ? https : http
      /** @type {string[]} */
      const chunks = []
      let total = 0
      const req = lib.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname || '/',
          method: 'GET',
          timeout: 8000,
          headers: { Accept: 'text/html,application/xhtml+xml' }
        },
        (res) => {
          const code = res.statusCode ?? 0
          res.on('data', (chunk) => {
            total += chunk.length
            if (total <= MAX_VIEWER_HTML_BYTES) {
              chunks.push(String(chunk))
            }
          })
          res.on('end', () => {
            resolve({
              http200: code === 200,
              ok: code > 0 && code < 500,
              statusCode: code,
              body: chunks.join('')
            })
          })
        }
      )
      req.on('timeout', () => {
        req.destroy()
        resolve({ http200: false, ok: false, statusCode: 0, body: '' })
      })
      req.on('error', () => resolve({ http200: false, ok: false, statusCode: 0, body: '' }))
      req.end()
    } catch {
      resolve({ http200: false, ok: false, statusCode: 0, body: '' })
    }
  })
}

/**
 * @param {string} state
 * @param {number} elapsedMs
 */
function readinessPercent(state, elapsedMs) {
  const base = {
    [DESKTOP_READINESS_STATE.PULLING_IMAGE]: 74,
    [DESKTOP_READINESS_STATE.DOWNLOADING_OS]: 78,
    [DESKTOP_READINESS_STATE.CREATING_DISK]: 82,
    [DESKTOP_READINESS_STATE.INSTALLING_OS]: 86,
    [DESKTOP_READINESS_STATE.FIRST_BOOT]: 89,
    [DESKTOP_READINESS_STATE.BOOTING]: 91,
    [DESKTOP_READINESS_STATE.VIEWER_STARTING]: 93,
    [DESKTOP_READINESS_STATE.VIEWER_AVAILABLE]: 94,
    [DESKTOP_READINESS_STATE.LOGIN_SCREEN]: 96,
    [DESKTOP_READINESS_STATE.DESKTOP_READY]: 98
  }
  const p = base[state] ?? 88
  const bump = Math.min(4, Math.floor(elapsedMs / 120_000))
  return Math.min(97, p + bump)
}

/**
 * @param {object} params
 */
export async function waitForDesktopWorkstationReady(params) {
  const {
    containerId,
    profile,
    dockerRuntime = null,
    progress = null,
    startedAtMs = Date.now(),
    sessionId = null
  } = params

  if (sessionId) {
    registerDesktopReadinessWait(sessionId)
  }

  try {
    const resolved = resolveDesktopWorkstationProfile(profile)
    const isWindows = resolved?.desktopOsFamily === 'windows' || resolved?.type === 'windows'
    const dockerOpts = isWslDockerKvmRuntime(dockerRuntime) ? { runtime: dockerRuntime } : {}
    const webViewerPort = resolved?.desktopWebPort ?? 8006

    let lastState = isWindows
      ? DESKTOP_READINESS_STATE.DOWNLOADING_OS
      : DESKTOP_READINESS_STATE.PULLING_IMAGE
    let lastEmitAt = 0
    /** @type {number | null} */
    let viewerHttp200Since = null

    const emitProgress = (state, extraMessage, extras = {}) => {
      const message = extraMessage ?? READINESS_DISPLAY_MESSAGES[state] ?? 'Preparing desktop workstation…'
      const showInstallingNote =
        !isDesktopReadinessComplete(state) &&
        (SETUP_PHASE_STATES.has(state) ||
          state === DESKTOP_READINESS_STATE.VIEWER_AVAILABLE ||
          extras.installing === true)
      const fullMessage = showInstallingNote ? `${message} ${FIRST_SETUP_NOTE}` : message
      progress?.emit?.('desktop_readiness', {
        status: state === DESKTOP_READINESS_STATE.FAILED ? 'error' : 'running',
        message: fullMessage,
        percent: readinessPercent(state, Date.now() - startedAtMs),
        readinessState: state,
        desktopUrl: extras.desktopUrl ?? null,
        viewerHttpOk: extras.viewerHttpOk === true,
        windowsInstalling: showInstallingNote === true,
        setupLogTail: extras.setupLogTail ?? null
      })
      lastEmitAt = Date.now()
    }

    emitProgress(lastState, 'Preparing desktop workstation…')

    while (true) {
      progress?.checkCancel?.()

      const containerState = await dockerManager.inspectContainerState(containerId, dockerOpts).catch(() => null)
      if (!containerState?.running) {
        const exitCode = containerState?.exitCode
        const logs = await dockerManager.getContainerLogs(containerId, { tail: 120, ...dockerOpts }).catch(() => ({
          logs: ''
        }))
        const summary =
          exitCode != null
            ? `Desktop container stopped (exit ${exitCode}).`
            : 'Desktop container is not running.'
        progress?.emit?.('desktop_readiness', {
          status: 'error',
          message: summary,
          readinessState: DESKTOP_READINESS_STATE.FAILED
        })
        throw new WorkstationStartError(summary, {
          stage: 'desktop_readiness_failed',
          report: logs.logs?.slice(0, 8000) ?? '',
          hints: ['container_exited']
        })
      }

      const logs = await dockerManager.getContainerLogs(containerId, { tail: 120, ...dockerOpts }).catch(() => ({
        logs: ''
      }))
      const logText = logs.logs ?? ''
      const logState = classifyReadinessFromLogs(logText, isWindows)

      const accessRoutes = await inspectWorkstationAccessRoutes(containerId, {
        dockerRuntime,
        webViewerPort
      })
      const novnc = accessRoutes.find((r) => r.type === 'novnc')
      const desktopUrl = novnc?.url ?? null
      const viewerPort = novnc?.port ?? 0
      const viewerHost = novnc?.host ?? '127.0.0.1'
      const viewerPortMapped = viewerPort > 0

      let viewerHttp200 = false
      let viewerHtml = ''
      if (viewerPortMapped && (await tcpProbe(viewerHost, viewerPort, 3000)) && desktopUrl) {
        const page = await fetchViewerPage(desktopUrl)
        viewerHttp200 = page.http200 === true
        viewerHtml = page.body
      }

      if (viewerHttp200) {
        if (viewerHttp200Since == null) {
          viewerHttp200Since = Date.now()
        }
      } else {
        viewerHttp200Since = null
      }

      const viewerStableMs =
        viewerHttp200Since != null ? Math.max(0, Date.now() - viewerHttp200Since) : 0

      const evaluation = isWindows
        ? evaluateWindowsDesktopReady({
            logText,
            logState,
            html: viewerHtml,
            viewerHttp200,
            viewerPortMapped,
            viewerStableMs,
            forceReady: sessionId ? isDesktopReadinessForced(sessionId) : false
          })
        : evaluateLinuxDesktopReady({
            logText,
            html: viewerHtml,
            logState,
            viewerHttp200,
            viewerPortMapped,
            viewerStableMs
          })

      const windowsDesktopUsable =
        !isWindows ||
        evaluation.manualOverride === true ||
        (evaluation.ready === true &&
          isDesktopReadinessComplete(evaluation.state) &&
          (evaluation.viaLogs === true || evaluation.viaViewerFallback === true))

      if (evaluation.ready && windowsDesktopUsable) {
        const finalState = evaluation.state
        const readiness = {
          state: finalState,
          message: READINESS_DISPLAY_MESSAGES[finalState],
          desktopUrl,
          accessRoutes,
          viewerPort,
          readyAt: new Date().toISOString(),
          firstSetupNote: FIRST_SETUP_NOTE
        }
        progress?.emit?.('desktop_readiness', {
          status: 'success',
          message: readiness.message,
          percent: 98,
          readinessState: finalState,
          desktopUrl,
          viewerHttpOk: true
        })
        return readiness
      }

      const nextState = evaluation.state ?? logState ?? lastState

      const progressExtras = {
        desktopUrl,
        viewerHttpOk: viewerHttp200,
        installing: evaluation.installing === true,
        setupLogTail: formatDesktopSetupLogTail(logText)
      }

      if (nextState !== lastState || Date.now() - lastEmitAt > 12_000) {
        emitProgress(nextState, null, progressExtras)
        lastState = nextState
      } else if (desktopUrl && Date.now() - lastEmitAt > 15_000) {
        emitProgress(lastState, null, progressExtras)
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }
  } finally {
    if (sessionId) {
      unregisterDesktopReadinessWait(sessionId)
    }
  }
}

/**
 * @param {object | null | undefined} profile
 */
export function profileRequiresDesktopReadinessWait(profile) {
  if (!profile) return false
  return isDesktopContainerProfile(profile) || isDesktopOnlyWorkstationProfile(profile)
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const DESKTOP_READINESS_STATE = {
  PULLING_IMAGE: 'pulling-image',
  DOWNLOADING_OS: 'downloading-os',
  CREATING_DISK: 'creating-disk',
  INSTALLING_OS: 'installing-os',
  FIRST_BOOT: 'first-boot',
  BOOTING: 'booting',
  VIEWER_STARTING: 'viewer-starting',
  VIEWER_AVAILABLE: 'viewer-available',
  LOGIN_SCREEN: 'login-screen',
  DESKTOP_READY: 'desktop-ready',
  FAILED: 'failed'
}

/** @deprecated HTTP stability no longer auto-marks Windows ready. Kept for Linux fallback. */
export const VIEWER_HTTP_STABLE_MS = 5000

/** @deprecated Windows no longer auto-readies from HTTP viewer stability alone. */
export const WINDOWS_VIEWER_STABLE_READY_MS = 120_000

const LOG_TAIL_LINES = 12
const LOG_RECENT_LINES = 25

/**
 * @param {string} logText
 * @param {number} [lines]
 */
function recentLogLines(logText, lines = LOG_RECENT_LINES) {
  return logText.split('\n').slice(-lines).join('\n')
}

export const SETUP_PHASE_STATES = new Set([
  DESKTOP_READINESS_STATE.PULLING_IMAGE,
  DESKTOP_READINESS_STATE.DOWNLOADING_OS,
  DESKTOP_READINESS_STATE.CREATING_DISK,
  DESKTOP_READINESS_STATE.INSTALLING_OS,
  DESKTOP_READINESS_STATE.FIRST_BOOT
])

/** Log lines that indicate UEFI/QEMU boot — OS is not usable yet. */
const WINDOWS_BOOTING_LOG = [
  /bdsdxe/i,
  /boot000\d/i,
  /failed to load boot/i,
  /harddisk.*not found/i,
  /skipped boot/i,
  /booting windows using qemu/i,
  /qemu v[\d.]+/i
]

const WINDOWS_ACTIVE_SETUP_LOG = [
  /downloading\s+https?:\/\//i,
  /downloading\s+windows/i,
  /download.*\d+\s*%/i,
  /creating\s+(a\s+)?\d+.*gb/i,
  /growable\s+disk/i,
  /building\s+(windows|vm|image)/i,
  /installing\s+windows/i,
  /installation\s+started/i,
  /waiting\s+for\s+installer/i,
  /extracting.*iso/i,
  /sysprep|oobe|setup\.exe/i,
  /loading boot0001.*dvd/i
]

/** Log lines that indicate the OS is usable — not merely that the web viewer is up. */
const WINDOWS_RELIABLE_READY_LOG = [
  /❯\s*ready!?/i,
  /\bwindows\s+started\b/i,
  /finished\s+installing/i,
  /boot\s+completed?/i,
  /boot\s+complete/i,
  /rdp\s+server\s+listening/i,
  /login\s+screen/i,
  /user\s+logged\s+in/i
]

const LINUX_SETUP_HTML = [
  /downloading/i,
  /installing/i,
  /please\s+wait/i,
  /initializing/i,
  /starting\s+up/i
]

/**
 * @param {string} recentLog
 */
export function logsIndicateWindowsBooting(recentLog) {
  const tail = recentLog.split('\n').slice(-LOG_TAIL_LINES).join('\n')
  return WINDOWS_BOOTING_LOG.some((re) => re.test(tail))
}

/**
 * @param {string} recentLog
 */
export function logsIndicateActiveWindowsSetup(recentLog) {
  return WINDOWS_ACTIVE_SETUP_LOG.some((re) => re.test(recentLog))
}

/**
 * @param {string} recentLog
 */
export function logsIndicateWindowsReady(recentLog) {
  const tail = recentLog.split('\n').slice(-LOG_TAIL_LINES).join('\n')
  if (logsIndicateWindowsBooting(tail)) return false
  if (WINDOWS_RELIABLE_READY_LOG.some((re) => re.test(tail))) return true
  if (logsIndicateActiveWindowsSetup(tail)) return false
  if (logsIndicateWindowsBooting(recentLog)) return false
  return WINDOWS_RELIABLE_READY_LOG.some((re) => re.test(recentLog))
}

/**
 * @param {string} logText
 * @param {boolean} isWindows
 */
export function classifyReadinessFromLogs(logText, isWindows) {
  const recent = recentLogLines(logText)
  const tail = recentLogLines(logText, LOG_TAIL_LINES)

  if (isWindows) {
    if (/pulling\s+from|pulling\s+fs\s+layer|manifest/i.test(tail)) {
      return DESKTOP_READINESS_STATE.PULLING_IMAGE
    }
    if (logsIndicateActiveWindowsSetup(tail) && /download/i.test(tail)) {
      return DESKTOP_READINESS_STATE.DOWNLOADING_OS
    }
    if (/creating\s+(a\s+)?\d+|growable\s+disk|formatting\s+disk/i.test(tail)) {
      return DESKTOP_READINESS_STATE.CREATING_DISK
    }
    if (logsIndicateWindowsReady(recent)) {
      if (/login|sign[\s-]?in/i.test(recent)) {
        return DESKTOP_READINESS_STATE.LOGIN_SCREEN
      }
      return DESKTOP_READINESS_STATE.DESKTOP_READY
    }
    if (/installing\s+windows|installation|sysprep|oobe|setup\.exe/i.test(tail)) {
      return DESKTOP_READINESS_STATE.INSTALLING_OS
    }
    if (/first\s+boot|initial\s+boot|specialize/i.test(tail)) {
      return DESKTOP_READINESS_STATE.FIRST_BOOT
    }
    if (/web\s+ui|http.*listening|novnc|vnc.*listening/i.test(tail)) {
      return DESKTOP_READINESS_STATE.VIEWER_AVAILABLE
    }
    if (/booting|qemu|power\s+on|bdsdxe/i.test(tail)) {
      return DESKTOP_READINESS_STATE.BOOTING
    }
    return null
  }

  if (/pulling|extracting|download/i.test(recent)) {
    return DESKTOP_READINESS_STATE.PULLING_IMAGE
  }
  if (/install|setup|first\s+run/i.test(recent)) {
    return DESKTOP_READINESS_STATE.INSTALLING_OS
  }
  if (/boot|starting/i.test(recent)) {
    return DESKTOP_READINESS_STATE.BOOTING
  }
  return null
}

/**
 * @param {string} html
 * @param {boolean} isWindows
 */
export function viewerHtmlIndicatesSetup(html, isWindows) {
  if (!html || html.length < 8) return false
  if (!isWindows) {
    return LINUX_SETUP_HTML.some((re) => re.test(html))
  }
  // noVNC viewer HTML heuristics (best-effort): different Windows images emit different strings.
  // Treat common OOBE / setup phrases as "not ready to use yet" to avoid starting timers too early.
  return (
    /downloading\s+windows|installing\s+windows|building\s+windows|download\s+progress/i.test(html) ||
    /please\s+wait.*setup|setup\s+is\s+starting|windows\s+for\s+docker/i.test(html) ||
    /getting\s+a\s+few\s+things\s+ready|we'?re\s+getting\s+a\s+few\s+things\s+ready/i.test(html) ||
    /windows\s+\d{2}\s+setup/i.test(html) ||
    /working\s+on\s+updates|preparing\s+your\s+computer|just\s+a\s+moment/i.test(html)
  )
}

/**
 * @param {object} params
 */
export function evaluateWindowsDesktopReady(params) {
  const {
    logText,
    logState,
    html,
    viewerHttp200,
    viewerPortMapped,
    forceReady = false
  } = params
  const recent = recentLogLines(logText, 40)
  const tail = recentLogLines(logText, LOG_TAIL_LINES)
  const viewerAvailable = viewerPortMapped && viewerHttp200
  const booting = logsIndicateWindowsBooting(tail) || logState === DESKTOP_READINESS_STATE.BOOTING
  const setupActive =
    booting ||
    logsIndicateActiveWindowsSetup(tail) ||
    (logState && SETUP_PHASE_STATES.has(logState) && logsIndicateActiveWindowsSetup(tail)) ||
    (html && viewerHtmlIndicatesSetup(html, true))

  if (forceReady && viewerAvailable) {
    return {
      ready: true,
      state: DESKTOP_READINESS_STATE.DESKTOP_READY,
      manualOverride: true
    }
  }

  if (booting) {
    return {
      ready: false,
      state: DESKTOP_READINESS_STATE.BOOTING,
      viewerAvailable,
      installing: true
    }
  }

  if (logsIndicateWindowsReady(recent)) {
    // Guard against false positives: if viewer content still indicates setup/OOBE, do not mark ready yet.
    if (viewerHtmlIndicatesSetup(html, true)) {
      return {
        ready: false,
        state: logState && SETUP_PHASE_STATES.has(logState)
          ? logState
          : DESKTOP_READINESS_STATE.INSTALLING_OS,
        viewerAvailable,
        installing: true
      }
    }
    const state =
      logState === DESKTOP_READINESS_STATE.LOGIN_SCREEN || /login|sign[\s-]?in/i.test(recent)
        ? DESKTOP_READINESS_STATE.LOGIN_SCREEN
        : DESKTOP_READINESS_STATE.DESKTOP_READY
    return { ready: true, state, viaLogs: true }
  }

  if (setupActive) {
    const state =
      logState && SETUP_PHASE_STATES.has(logState)
        ? logState
        : DESKTOP_READINESS_STATE.INSTALLING_OS
    return {
      ready: false,
      state,
      viewerAvailable,
      installing: true
    }
  }

  if (viewerAvailable) {
    return {
      ready: false,
      state: DESKTOP_READINESS_STATE.VIEWER_AVAILABLE,
      viewerAvailable: true
    }
  }

  return {
    ready: false,
    state: logState ?? DESKTOP_READINESS_STATE.BOOTING
  }
}

/**
 * @param {object} params
 */
export function evaluateLinuxDesktopReady(params) {
  const {
    logText,
    html,
    logState,
    viewerHttp200,
    viewerPortMapped,
    viewerStableMs = 0,
    forceReady = false
  } = params

  if (!viewerPortMapped || !viewerHttp200) {
    return { ready: false, state: logState ?? DESKTOP_READINESS_STATE.BOOTING }
  }

  if (forceReady) {
    return { ready: true, state: DESKTOP_READINESS_STATE.DESKTOP_READY, manualOverride: true }
  }

  if (logState && SETUP_PHASE_STATES.has(logState)) {
    return { ready: false, state: logState, viewerAvailable: true, installing: true }
  }

  if (html && viewerHtmlIndicatesSetup(html, false)) {
    return {
      ready: false,
      state: DESKTOP_READINESS_STATE.VIEWER_AVAILABLE,
      viewerAvailable: true,
      installing: true
    }
  }

  if (viewerStableMs >= VIEWER_HTTP_STABLE_MS) {
    return { ready: true, state: DESKTOP_READINESS_STATE.DESKTOP_READY, viaViewerFallback: true }
  }

  if (/ready|started|listening\s+on/i.test(logText)) {
    return { ready: true, state: DESKTOP_READINESS_STATE.DESKTOP_READY, viaLogs: true }
  }

  if (viewerHttp200) {
    return {
      ready: false,
      state: DESKTOP_READINESS_STATE.VIEWER_AVAILABLE,
      viewerAvailable: true
    }
  }

  return { ready: false, state: logState ?? DESKTOP_READINESS_STATE.VIEWER_STARTING }
}

/**
 * @param {string | null | undefined} state
 */
export function isDesktopReadinessComplete(state) {
  return (
    state === DESKTOP_READINESS_STATE.DESKTOP_READY || state === DESKTOP_READINESS_STATE.LOGIN_SCREEN
  )
}

/**
 * @param {string | null | undefined} state
 */
export function formatReadinessStateLabel(state) {
  switch (state) {
    case DESKTOP_READINESS_STATE.VIEWER_AVAILABLE:
      return 'Viewer available'
    case DESKTOP_READINESS_STATE.INSTALLING_OS:
    case DESKTOP_READINESS_STATE.DOWNLOADING_OS:
    case DESKTOP_READINESS_STATE.CREATING_DISK:
    case DESKTOP_READINESS_STATE.FIRST_BOOT:
    case DESKTOP_READINESS_STATE.PULLING_IMAGE:
      return 'Installing OS'
    case DESKTOP_READINESS_STATE.LOGIN_SCREEN:
    case DESKTOP_READINESS_STATE.DESKTOP_READY:
      return 'Ready'
    default:
      return state ? state.replace(/-/g, ' ') : 'starting'
  }
}

const ANSI_ESCAPE_RE = /\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g
const ORPHAN_SGR_RE = /\[(?:\d{1,3}(?:;\d{1,3})*)?m/g

/**
 * Strip ANSI / terminal color codes from a single log line.
 * @param {string} line
 */
export function sanitizeSetupLogLine(line) {
  return line.replace(ANSI_ESCAPE_RE, '').replace(ORPHAN_SGR_RE, '').trim()
}

/**
 * Strip ANSI color codes and return the most recent setup log lines for UI preview.
 * @param {string | null | undefined} logText
 * @param {number} [maxLines]
 * @returns {string[]}
 */
export function formatDesktopSetupLogTail(logText, maxLines = 12) {
  if (!logText || typeof logText !== 'string') return []
  return logText
    .split('\n')
    .map((line) => sanitizeSetupLogLine(line))
    .filter(Boolean)
    .slice(-maxLines)
}

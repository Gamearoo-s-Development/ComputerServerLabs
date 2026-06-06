/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { app, BrowserWindow, dialog, nativeImage } from 'electron'
import { attachWebContentSecurityGuards, getSecureWebPreferences } from './security/electronSecurity.js'
import fs from 'fs'
import { getSessionState } from './labManager.js'
import { checkPtyAvailable } from './terminalManager.js'
import { detachTerminalsForSession, getTerminalStatusForSession } from './terminalManager.js'
import { createTerminalTrace, formatTerminalDebugLog } from './terminalDebug.js'
import { getPreloadPath, getTerminalHtmlPath, resolveIconPath } from './utils/paths.js'
import { logger } from './utils/logger.js'

const TERMINAL_BG = '#0a0c10'
const TERMINAL_WIDTH = 1000
const TERMINAL_HEIGHT = 700

/** @type {Map<string, import('electron').BrowserWindow>} */
const terminalWindows = new Map()

/**
 * @param {string} sessionId
 */
export function closeLabTerminalWindow(sessionId) {
  const win = terminalWindows.get(sessionId)
  if (!win || win.isDestroyed()) {
    terminalWindows.delete(sessionId)
    return { closed: false }
  }
  win.close()
  return { closed: true }
}

/**
 * @param {string} sessionId
 */
export function getLabTerminalWindowStatus(sessionId) {
  const win = terminalWindows.get(sessionId)
  const windowOpen = Boolean(win && !win.isDestroyed())
  const attach = getTerminalStatusForSession(sessionId)
  return {
    windowOpen,
    attached: attach.attached,
    terminalId: attach.terminalId
  }
}

/**
 * @param {import('electron').BrowserWindow} win
 * @param {ReturnType<typeof createTerminalTrace>} trace
 */
function wireWindowDiagnostics(win, trace) {
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    trace.log('BrowserWindow.did-fail-load', { errorCode, errorDescription, validatedURL })
    logger.error('terminal', 'Terminal window failed to load', {
      errorCode,
      errorDescription,
      validatedURL
    })
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    trace.log('BrowserWindow.render-process-gone', details)
    logger.error('terminal', 'Terminal renderer crashed', details)
  })

  win.on('unresponsive', () => {
    trace.log('BrowserWindow.unresponsive')
    logger.warn('terminal', 'Terminal window unresponsive')
  })

  win.on('responsive', () => {
    trace.log('BrowserWindow.responsive')
  })
}

/**
 * @param {string} sessionId
 */
export async function openLabTerminalWindow(sessionId) {
  const trace = createTerminalTrace(sessionId)
  trace.log('terminal.button.clicked')

  const existing = terminalWindows.get(sessionId)
  if (existing && !existing.isDestroyed()) {
    trace.log('BrowserWindow.focus_existing')
    existing.focus()
    return {
      opened: false,
      focused: true,
      windowOpen: true,
      debugLog: formatTerminalDebugLog(sessionId)
    }
  }

  trace.log('ipc.open.request_received', { sessionId })

  let session
  try {
    session = getSessionState(sessionId)
    trace.log('session.found', { status: session.status, labId: session.labId })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    trace.log('session.not_found', { message })
    throw new Error(message)
  }

  if (session.status !== 'running') {
    trace.log('session.not_running', { status: session.status })
    throw new Error('Lab session is not running. Start the lab before opening the terminal.')
  }

  const ptyCheck = await checkPtyAvailable()
  if (!ptyCheck.available) {
    trace.log('node-pty.unavailable', { message: ptyCheck.message })
    throw new Error(ptyCheck.message ?? 'node-pty is not available on this system.')
  }
  trace.log('node-pty.available')

  const helperId = session.helper?.containerId ?? session.containerId
  if (!helperId) {
    trace.log('helper.container.missing')
    throw new Error('Helper container is not ready. Restart the lab and try again.')
  }
  trace.log('helper.container.detected', { containerId: helperId })

  const preloadPath = getPreloadPath()
  if (!fs.existsSync(preloadPath)) {
    trace.log('preload.missing', { preloadPath })
    throw new Error(`Terminal preload script not found at ${preloadPath}`)
  }
  trace.log('preload.resolved', { preloadPath })

  const iconPath = resolveIconPath()
  let windowIcon
  if (iconPath) {
    const image = nativeImage.createFromPath(iconPath)
    if (!image.isEmpty()) windowIcon = image
  }

  trace.log('BrowserWindow.creation.started', { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT })

  const win = new BrowserWindow({
    width: TERMINAL_WIDTH,
    height: TERMINAL_HEIGHT,
    minWidth: 640,
    minHeight: 400,
    title: 'Lab Terminal',
    backgroundColor: TERMINAL_BG,
    autoHideMenuBar: true,
    show: false,
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: getSecureWebPreferences(preloadPath)
  })

  attachWebContentSecurityGuards(win.webContents, { parentWindow: win })
  terminalWindows.set(sessionId, win)
  wireWindowDiagnostics(win, trace)
  trace.log('BrowserWindow.created', { id: win.id })

  win.on('closed', () => {
    terminalWindows.delete(sessionId)
    detachTerminalsForSession(sessionId)
    trace.log('BrowserWindow.closed')
    logger.info('terminal', 'Lab terminal window closed', { sessionId })
  })

  const query = new URLSearchParams({ sessionId })
  let loadTarget = ''

  try {
    if (process.env.ELECTRON_RENDERER_URL) {
      const base = process.env.ELECTRON_RENDERER_URL.replace(/\/$/, '')
      loadTarget = `${base}/terminal.html?${query.toString()}`
      trace.log('BrowserWindow.loadURL', { loadTarget })
      await win.loadURL(loadTarget)
    } else {
      const htmlPath = getTerminalHtmlPath()
      if (!fs.existsSync(htmlPath)) {
        trace.log('terminal.html.missing', { htmlPath })
        throw new Error(`Terminal page not found at ${htmlPath}. Run: npm run build`)
      }
      loadTarget = htmlPath
      trace.log('BrowserWindow.loadFile', { htmlPath, sessionId })
      await win.loadFile(htmlPath, { query: { sessionId } })
    }
    trace.log('BrowserWindow.page_loaded')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    trace.log('BrowserWindow.load_failed', { message, loadTarget })
    if (!win.isDestroyed()) {
      win.destroy()
    }
    terminalWindows.delete(sessionId)
    throw new Error(`Could not load terminal window: ${message}`)
  }

  win.show()
  win.focus()
  trace.log('BrowserWindow.shown')
  trace.log('xterm.renderer.awaiting_attach')

  logger.info('terminal', 'Lab terminal window opened', { sessionId })

  return {
    opened: true,
    focused: true,
    windowOpen: true,
    debugLog: formatTerminalDebugLog(sessionId)
  }
}

export function closeAllLabTerminalWindows() {
  for (const sessionId of [...terminalWindows.keys()]) {
    closeLabTerminalWindow(sessionId)
  }
}

/**
 * Show native error dialog when terminal cannot open (dev-friendly).
 * @param {import('electron').BrowserWindow | null} parent
 * @param {string} message
 * @param {string} debugLog
 */
export function showTerminalErrorDialog(parent, message, debugLog) {
  const detail =
    process.env.NODE_ENV === 'development' || !app.isPackaged
      ? debugLog
      : `${message}\n\nEnable Developer Mode in Settings to copy debug logs from the lab session.`
  void dialog.showMessageBox(parent ?? undefined, {
    type: 'error',
    title: 'Lab Terminal',
    message: message.includes('Sandbox helper') ? message : 'Could not start sandbox terminal.',
    detail: detail.slice(0, 8000)
  })
}

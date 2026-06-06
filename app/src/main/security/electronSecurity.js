/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import path from 'path'
import { app, dialog, shell } from 'electron'
import { logger } from '../utils/logger.js'

const ALLOWED_DEV_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])

/**
 * Hardened webPreferences shared by all application windows.
 * @param {string} preloadPath
 */
export function getSecureWebPreferences(preloadPath) {
  const absolutePreload = path.isAbsolute(preloadPath) ? preloadPath : path.resolve(preloadPath)
  return {
    preload: absolutePreload,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webSecurity: true,
    webviewTag: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    enableWebSQL: false,
    disableBlinkFeatures: 'Auxclick'
  }
}

/**
 * @param {string} url
 */
export function isAllowedNavigationUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (url.startsWith('file://')) return true
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl && url.startsWith(devUrl.replace(/\/$/, ''))) return true
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'file:') return true
    if (process.env.ELECTRON_RENDERER_URL) {
      const dev = new URL(process.env.ELECTRON_RENDERER_URL)
      if (parsed.origin === dev.origin) return true
    }
    if (ALLOWED_DEV_ORIGINS.has(parsed.origin)) return true
  } catch {
    return false
  }
  return false
}

/**
 * Block unexpected navigation and window.open from renderer content.
 * @param {import('electron').WebContents} webContents
 * @param {{ parentWindow?: import('electron').BrowserWindow }} [options]
 */
export function attachWebContentSecurityGuards(webContents, options = {}) {
  const { parentWindow } = options

  webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigationUrl(url)) {
      event.preventDefault()
      logger.warn('security', 'Blocked navigation', { url })
    }
  })

  webContents.on('will-redirect', (event, url) => {
    if (!isAllowedNavigationUrl(url)) {
      event.preventDefault()
      logger.warn('security', 'Blocked redirect', { url })
    }
  })

  webContents.setWindowOpenHandler(({ url }) => {
    if (url && /^https?:\/\//i.test(url)) {
      void confirmAndOpenExternal(url, parentWindow)
    } else {
      logger.warn('security', 'Blocked window.open', { url })
    }
    return { action: 'deny' }
  })
}

/**
 * @param {string} url
 * @param {import('electron').BrowserWindow | null | undefined} parentWindow
 */
export async function confirmAndOpenExternal(url, parentWindow) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return { opened: false, reason: 'invalid_url' }
  }

  const { response } = await dialog.showMessageBox(parentWindow ?? undefined, {
    type: 'question',
    buttons: ['Open in browser', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: 'Open external link?',
    message: 'Open this link in your default browser?',
    detail: url.slice(0, 500)
  })

  if (response !== 0) {
    return { opened: false, reason: 'canceled' }
  }

  await shell.openExternal(url)
  return { opened: true }
}

/**
 * Apply process-wide Electron hardening (call once before app.ready).
 */
export function applyElectronProcessHardening() {
  app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors')
  app.commandLine.appendSwitch('js-flags', '--no-expose-wasm')
}

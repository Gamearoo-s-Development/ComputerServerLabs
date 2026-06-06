/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { app, BrowserWindow, nativeImage } from 'electron'
import {
  applyElectronProcessHardening,
  attachWebContentSecurityGuards,
  getSecureWebPreferences
} from './security/electronSecurity.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { bootstrapMainServices, registerIpcHandlers, shutdownMainServices } from './ipc/handlers.js'
import { initDiscordRpc, setDiscordRpcEnabled, shutdownDiscordRpc } from './discordRpcManager.js'
import { cleanupAllManagedResources } from './labCleanupManager.js'
import * as dockerManager from './dockerManager.js'
import {
  shutdownAllActiveLabSessionsForAppQuit,
  shutdownIncompleteLabStartupForAppQuit
} from './labManager.js'
import { getAllSettings } from './settingsManager.js'
import { getPreloadPath, resolveIconPath } from './utils/paths.js'
import { logger } from './utils/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

applyElectronProcessHardening()

const WINDOW_BG = '#0f1117'
const TITLEBAR_COLOR = '#12151c'
const TITLEBAR_SYMBOL = '#e5e7eb'
const FADE_STEP_MS = 16
const FADE_STEP = 0.08

function loadWindowIcon() {
  const iconPath = resolveIconPath()
  if (!iconPath) return undefined
  const image = nativeImage.createFromPath(iconPath)
  return image.isEmpty() ? undefined : image
}

function fadeInWindow(window) {
  window.setOpacity(0)
  window.show()

  let opacity = 0
  const timer = setInterval(() => {
    opacity = Math.min(1, opacity + FADE_STEP)
    window.setOpacity(opacity)
    if (opacity >= 1) {
      clearInterval(timer)
      window.setOpacity(1)
    }
  }, FADE_STEP_MS)
}

function applyWindowsTitleBar(window) {
  if (process.platform !== 'win32') return

  try {
    window.setTitleBarOverlay({
      color: TITLEBAR_COLOR,
      symbolColor: TITLEBAR_SYMBOL,
      height: 32
    })
  } catch {
    // Overlay requires Windows 11 / supported builds.
  }
}

function createWindow() {
  const icon = loadWindowIcon()
  const preloadPath = getPreloadPath()
  const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)

  if (!fs.existsSync(preloadPath)) {
    logger.error('main', 'Preload script not found', { preloadPath })
  } else {
    logger.info('main', 'Preload script resolved', { preloadPath, isDev })
  }

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: WINDOW_BG,
    title: 'Computer Server Labs',
    ...(icon ? { icon } : {}),
    webPreferences: getSecureWebPreferences(preloadPath)
  })

  attachWebContentSecurityGuards(mainWindow.webContents, { parentWindow: mainWindow })

  mainWindow.webContents.on('preload-error', (_event, failedPath, error) => {
    logger.error('main', 'Preload script failed to load', {
      preloadPath: failedPath,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  })

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('main', 'Renderer finished loading', {
      url: mainWindow.webContents.getURL()
    })
  })

  registerIpcHandlers(mainWindow)

  applyWindowsTitleBar(mainWindow)

  mainWindow.once('ready-to-show', () => {
    fadeInWindow(mainWindow)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  logger.info('main', 'Window created')
  return mainWindow
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.sysadmingame.quizes')
  }

  bootstrapMainServices()

  const settings = getAllSettings()
  setDiscordRpcEnabled(settings.discordRpcEnabled !== false)
  await initDiscordRpc()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

process.on('uncaughtException', (error) => {
  logger.error('main', 'Uncaught exception', {
    error: error instanceof Error ? error.message : String(error)
  })
})

process.on('unhandledRejection', (reason) => {
  logger.error('main', 'Unhandled rejection', {
    error: reason instanceof Error ? reason.message : String(reason)
  })
})

let quitting = false
app.on('before-quit', (event) => {
  if (quitting) return
  quitting = true
  event.preventDefault()
  ;(async () => {
    try {
      dockerManager.clearSgqInventoryRuntimeCache()
      await shutdownAllActiveLabSessionsForAppQuit()
    } catch (error) {
      logger.warn('main', 'Lab session shutdown on quit failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
    try {
      await shutdownIncompleteLabStartupForAppQuit()
    } catch (error) {
      logger.warn('main', 'Incomplete lab startup cleanup on quit failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
    try {
      await cleanupAllManagedResources({
        ephemeralOnly: true,
        removeImagesWhenCacheDisabled: true,
        includeRecoverableDesktop: true
      })
    } catch (error) {
      logger.warn('main', 'Docker cleanup on quit failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
    try {
      await shutdownDiscordRpc()
    } catch {
      // ignore
    }
    try {
      shutdownMainServices()
    } catch {
      // ignore
    }
    app.exit(0)
  })()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

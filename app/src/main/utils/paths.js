/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from './logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {string | null} */
let cachedProjectRoot = null

/** @type {boolean} */
let pathsLogged = false

function isDevRuntime() {
  return !app.isPackaged || Boolean(process.env.ELECTRON_RENDERER_URL)
}

/**
 * @param {string} dir
 */
function isProjectRoot(dir) {
  if (!dir) return false
  const pkg = path.join(dir, 'package.json')
  if (!fs.existsSync(pkg)) return false

  const hasLabs = fs.existsSync(path.join(dir, 'labs'))
  const hasConfig = fs.existsSync(path.join(dir, 'config', 'lab.schema.json'))
  const hasMain = fs.existsSync(path.join(dir, 'src', 'main', 'main.js'))

  try {
    const manifest = JSON.parse(fs.readFileSync(pkg, 'utf8'))
    const appNames = new Set(['@sysadmin-game/app', 'sysadmin-game-quizes'])
    if (appNames.has(manifest.name) && (hasLabs || hasMain)) {
      return true
    }
  } catch {
    // ignore malformed package.json
  }

  return hasConfig && hasLabs
}

/**
 * @param {string} startDir
 */
function findProjectRootFrom(startDir) {
  let current = path.resolve(startDir)
  const root = path.parse(current).root

  while (current && current !== root) {
    if (isProjectRoot(current)) {
      return current
    }
    current = path.dirname(current)
  }

  return null
}

/**
 * @returns {string[]}
 */
function projectRootCandidates() {
  const candidates = []

  if (process.resourcesPath) {
    candidates.push(process.resourcesPath)
  }

  try {
    const cwd = process.cwd()
    if (cwd) candidates.push(cwd)
  } catch {
    // ignore
  }

  try {
    const appPath = app.getAppPath()
    if (appPath) candidates.push(appPath)
  } catch {
    // ignore
  }

  candidates.push(__dirname)

  return [...new Set(candidates.map((c) => path.resolve(c)))]
}

function resolveProjectRoot() {
  if (cachedProjectRoot && isProjectRoot(cachedProjectRoot)) {
    return cachedProjectRoot
  }

  if (app.isPackaged && process.resourcesPath) {
    const resourcesRoot = path.resolve(process.resourcesPath)
    if (fs.existsSync(path.join(resourcesRoot, 'config', 'lab.schema.json'))) {
      cachedProjectRoot = resourcesRoot
      return cachedProjectRoot
    }
  }

  for (const start of projectRootCandidates()) {
    const found = findProjectRootFrom(start)
    if (found) {
      cachedProjectRoot = found
      return cachedProjectRoot
    }
  }

  const fallback = path.resolve(process.cwd())
  cachedProjectRoot = fallback
  return cachedProjectRoot
}

/** Project root (repo root in dev, resources root when packaged). */
export function getProjectRoot() {
  return resolveProjectRoot()
}

/**
 * @param {string} [fileName]
 */
export function getConfigPath(fileName) {
  const configDir = path.join(getProjectRoot(), 'config')
  return fileName ? path.join(configDir, fileName) : configDir
}

/** Directory containing lab packs (`labs/`). */
export function getLabsPath() {
  const candidates = []

  if (app.isPackaged && process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'labs'))
  }

  candidates.push(path.join(getProjectRoot(), 'labs'))

  try {
    const cwdLabs = path.join(process.cwd(), 'labs')
    if (!candidates.includes(cwdLabs)) {
      candidates.push(cwdLabs)
    }
  } catch {
    // ignore
  }

  const found = candidates.find((dir) => fs.existsSync(dir))
  return found ?? candidates[0]
}

/** @deprecated Use getConfigPath() */
export function getConfigRoot() {
  return getConfigPath()
}

/** @deprecated Use getLabsPath() */
export function getLabsRoot() {
  return getLabsPath()
}

/** Packaged extraResources or project `resources/` / `assets/`. */
export function getResourcesRoot() {
  const candidates = [
    path.join(getProjectRoot(), 'resources'),
    path.join(getProjectRoot(), 'assets'),
    path.join(process.cwd(), 'resources'),
    path.join(process.cwd(), 'assets')
  ]

  if (process.resourcesPath) {
    candidates.unshift(path.join(process.resourcesPath, 'assets'))
    candidates.unshift(path.join(process.resourcesPath, 'resources'))
  }

  return candidates.find((dir) => fs.existsSync(dir)) ?? candidates[0]
}

/**
 * @param {string} [fileName]
 */
export function getDocsPath(fileName) {
  const candidates = []

  if (app.isPackaged && process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'docs'))
  }

  candidates.push(path.join(getProjectRoot(), 'docs'))

  try {
    const cwdDocs = path.join(process.cwd(), 'docs')
    if (!candidates.includes(cwdDocs)) {
      candidates.push(cwdDocs)
    }
  } catch {
    // ignore
  }

  const docsDir = candidates.find((dir) => fs.existsSync(dir)) ?? candidates[0]
  return fileName ? path.join(docsDir, fileName) : docsDir
}

export function getUserDataRoot() {
  return app.getPath('userData')
}

export function getUserDataFile(name) {
  return path.join(getUserDataRoot(), name)
}

export function getOnlineLabsRoot() {
  return path.join(getUserDataRoot(), 'online-labs')
}

/**
 * @param {string} labId
 */
/**
 * @deprecated Prefer resolveLabCatalogLocation from labCatalogDiscovery.js
 * @param {string} labId
 */
export function resolveLabFolderPath(labId) {
  const treeRoot = getLabsPath()
  const bundled = path.join(treeRoot, labId, 'lab.json')
  if (fs.existsSync(bundled)) {
    return { labsRoot: treeRoot, folder: labId, labsTreeRoot: treeRoot, source: 'bundled', bundled: true }
  }
  const bundledNested = findNestedLabJson(treeRoot, path.join('bundled'), labId)
  if (bundledNested) return bundledNested
  const communityNested = findNestedLabJson(treeRoot, path.join('community', 'examples'), labId)
  if (communityNested) return { ...communityNested, source: 'community', bundled: false }
  const onlineRoot = getOnlineLabsRoot()
  const online = path.join(onlineRoot, labId, 'lab.json')
  if (fs.existsSync(online)) {
    return { labsRoot: onlineRoot, folder: labId, labsTreeRoot: onlineRoot, source: 'online', bundled: false }
  }
  return null
}

/**
 * @param {string} treeRoot
 * @param {string} segment
 * @param {string} labId
 */
function findNestedLabJson(treeRoot, segment, labId) {
  const base = path.join(treeRoot, segment)
  if (!fs.existsSync(base)) return null
  for (const track of fs.readdirSync(base, { withFileTypes: true })) {
    if (!track.isDirectory() || track.name.startsWith('_') || track.name.startsWith('.')) continue
    const candidate = path.join(base, track.name, labId, 'lab.json')
    if (fs.existsSync(candidate)) {
      return {
        labsRoot: path.join(base, track.name),
        folder: labId,
        labsTreeRoot: treeRoot,
        source: 'bundled',
        bundled: true
      }
    }
  }
  return null
}

/**
 * Log resolved paths once in development.
 */
export function logResolvedPaths() {
  if (!isDevRuntime() || pathsLogged) return
  pathsLogged = true

  logger.info('paths', 'Resolved application paths', {
    projectRoot: getProjectRoot(),
    configPath: getConfigPath('lab.schema.json'),
    labsPath: getLabsPath(),
    docsPath: getDocsPath('docker-setup.md'),
    isPackaged: app.isPackaged,
    cwd: process.cwd(),
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath ?? null,
    userData: getUserDataRoot()
  })
}

/**
 * Built preload script (electron-vite output).
 */
export function getPreloadPath() {
  const candidates = [
    path.join(__dirname, '../preload/preload.cjs'),
    path.join(__dirname, '../../preload/preload.cjs'),
    path.join(process.cwd(), 'out/preload/preload.cjs'),
    path.join(__dirname, '../preload/preload.mjs'),
    path.join(__dirname, '../../preload/preload.mjs'),
    path.join(process.cwd(), 'out/preload/preload.mjs')
  ]

  const found = candidates.find((candidate) => fs.existsSync(candidate))
  const resolved = path.resolve(found ?? candidates[0])
  return resolved
}

/**
 * Built terminal renderer page (electron-vite output).
 */
export function getTerminalHtmlPath() {
  const candidates = [
    path.join(__dirname, '../renderer/terminal.html'),
    path.join(__dirname, '../../renderer/terminal.html'),
    path.join(process.cwd(), 'out/renderer/terminal.html')
  ]

  if (process.resourcesPath) {
    candidates.unshift(path.join(process.resourcesPath, 'renderer', 'terminal.html'))
    candidates.unshift(path.join(process.resourcesPath, 'app.asar.unpacked', 'renderer', 'terminal.html'))
  }

  const found = candidates.find((candidate) => fs.existsSync(candidate))
  return found ?? candidates[0]
}

export function resolveIconPath() {
  const candidates = [
    path.join(getResourcesRoot(), 'icon.png'),
    path.join(process.cwd(), 'assets/icon.png'),
    path.join(process.cwd(), 'resources/icon.png'),
    path.join(app.getAppPath(), 'resources/icon.png')
  ]

  if (process.resourcesPath) {
    candidates.unshift(path.join(process.resourcesPath, 'assets', 'icon.png'))
    candidates.unshift(path.join(process.resourcesPath, 'resources', 'icon.png'))
  }

  return candidates.find((candidate) => fs.existsSync(candidate))
}

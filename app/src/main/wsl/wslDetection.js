/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { runCommand } from '../utils/exec.js'
import { logger } from '../utils/logger.js'

export const WSL_SETUP_GUIDE_URL = 'https://learn.microsoft.com/en-us/windows/wsl/install'

export const WSL_INSTALL_COMMAND = 'wsl --install'
export const WSL_SET_DEFAULT_VERSION_COMMAND = 'wsl --set-default-version 2'

/**
 * @typedef {{
 *   isWindowsHost: boolean
 *   installed: boolean
 *   wsl2Available: boolean
 *   defaultVersion: number | null
 *   defaultDistro: string | null
 *   distros: { name: string, state: string, version: number | null, default: boolean }[]
 *   dockerWslIntegration: 'unknown' | 'likely' | 'unlikely' | 'n/a'
 *   statusMessage: string
 * }} WslDetectionSnapshot
 */

/** @type {WslDetectionSnapshot | null} */
let cachedSnapshot = null
/** @type {number} */
let cachedAt = 0
const CACHE_MS = 45_000

/**
 * @param {string} stdout
 */
function parseWslListOutput(stdout) {
  /** @type {WslDetectionSnapshot['distros']} */
  const distros = []
  const lines = stdout.replace(/\0/g, '').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || /^NAME\s+/i.test(trimmed) || /^-+$/i.test(trimmed)) continue
    const match = trimmed.match(/^(\*?)\s*([^\s]+)\s+(Running|Stopped|Installing|Uninstalling)\s+(\d+)?/i)
    if (!match) continue
    distros.push({
      name: match[2],
      state: match[3],
      version: match[4] ? Number(match[4]) : null,
      default: match[1] === '*'
    })
  }
  return distros
}

/**
 * @param {string} stdout
 */
function parseWslStatusOutput(stdout) {
  let defaultVersion = null
  const versionMatch = stdout.match(/Default Version:\s*(\d+)/i)
  if (versionMatch) {
    defaultVersion = Number(versionMatch[1])
  }
  return { defaultVersion }
}

/**
 * @param {WslDetectionSnapshot['distros']} distros
 */
function inferDockerWslIntegration(distros) {
  if (!distros.length) return 'unknown'
  const dockerDistros = distros.filter((d) =>
    /docker-desktop|docker-desktop-data/i.test(d.name)
  )
  if (dockerDistros.some((d) => d.version === 2)) {
    return 'likely'
  }
  if (distros.length > 0) {
    return 'unlikely'
  }
  return 'unknown'
}

/**
 * @param {{ refresh?: boolean }} [options]
 * @returns {Promise<WslDetectionSnapshot>}
 */
export async function detectWslEnvironment(options = {}) {
  const now = Date.now()
  if (!options.refresh && cachedSnapshot && now - cachedAt < CACHE_MS) {
    return cachedSnapshot
  }

  if (process.platform !== 'win32') {
    cachedSnapshot = {
      isWindowsHost: false,
      installed: false,
      wsl2Available: false,
      defaultVersion: null,
      defaultDistro: null,
      distros: [],
      dockerWslIntegration: 'n/a',
      statusMessage: 'WSL is a Windows feature (not applicable on this host).'
    }
    cachedAt = now
    return cachedSnapshot
  }

  /** @type {WslDetectionSnapshot} */
  let snapshot = {
    isWindowsHost: true,
    installed: false,
    wsl2Available: false,
    defaultVersion: null,
    defaultDistro: null,
    distros: [],
    dockerWslIntegration: 'unknown',
    statusMessage: 'WSL not detected.'
  }

  try {
    const status = await runCommand('wsl.exe', ['--status'], { timeout: 15_000 })
    const statusText = `${status.stdout}\n${status.stderr}`
    if (status.ok || /WSL/i.test(statusText)) {
      snapshot.installed = true
      const parsed = parseWslStatusOutput(statusText)
      snapshot.defaultVersion = parsed.defaultVersion
      snapshot.wsl2Available = parsed.defaultVersion === 2
    }

    const list = await runCommand('wsl.exe', ['-l', '-v'], { timeout: 15_000 })
    if (list.ok && list.stdout.trim()) {
      snapshot.installed = true
      snapshot.distros = parseWslListOutput(list.stdout)
      const defaultDistro = snapshot.distros.find((d) => d.default) ?? snapshot.distros[0]
      snapshot.defaultDistro = defaultDistro?.name ?? null
      if (defaultDistro?.version === 2) {
        snapshot.wsl2Available = true
      }
      if (snapshot.distros.some((d) => d.version === 2)) {
        snapshot.wsl2Available = true
      }
      snapshot.dockerWslIntegration = inferDockerWslIntegration(snapshot.distros)
    }

    if (snapshot.installed) {
      const parts = []
      parts.push(snapshot.wsl2Available ? 'WSL 2 available' : 'WSL installed (WSL 2 not confirmed)')
      if (snapshot.defaultDistro) {
        parts.push(`default: ${snapshot.defaultDistro}`)
      }
      if (snapshot.defaultVersion != null) {
        parts.push(`default version: ${snapshot.defaultVersion}`)
      }
      if (snapshot.dockerWslIntegration === 'likely') {
        parts.push('Docker WSL integration: likely enabled')
      } else if (snapshot.dockerWslIntegration === 'unlikely') {
        parts.push('Docker WSL integration: not detected')
      }
      snapshot.statusMessage = parts.join(' · ')
    } else {
      snapshot.statusMessage = 'WSL not installed — use wsl --install (Administrator PowerShell).'
    }
  } catch (error) {
    logger.warn('wsl', 'WSL detection failed', {
      message: error instanceof Error ? error.message : String(error)
    })
    snapshot.statusMessage = 'WSL detection failed — run wsl --status manually.'
  }

  cachedSnapshot = snapshot
  cachedAt = now
  return snapshot
}

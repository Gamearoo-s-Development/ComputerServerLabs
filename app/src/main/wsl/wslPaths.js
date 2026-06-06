/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Convert a Windows path to a WSL path (for setup/help display only — not for mounts).
 * @param {string} windowsPath
 */
export function windowsPathToWsl(windowsPath) {
  if (!windowsPath || typeof windowsPath !== 'string') return null
  const trimmed = windowsPath.trim().replace(/\//g, '\\')
  const match = /^([a-zA-Z]):\\(.*)$/.exec(trimmed)
  if (!match) return null
  const drive = match[1].toLowerCase()
  const rest = match[2].replace(/\\/g, '/')
  return `/mnt/${drive}/${rest}`
}

/**
 * Convert a WSL /mnt/c/... path to Windows (for setup/help display only).
 * @param {string} wslPath
 */
export function wslPathToWindows(wslPath) {
  if (!wslPath || typeof wslPath !== 'string') return null
  const normalized = wslPath.trim().replace(/\\/g, '/')
  const match = /^\/mnt\/([a-zA-Z])\/(.*)$/.exec(normalized)
  if (!match) return null
  const drive = match[1].toUpperCase()
  const rest = match[2].replace(/\//g, '\\')
  return `${drive}:\\${rest}`
}

/**
 * Example conversions for the current app install (user-facing help).
 */
export function getExamplePathConversions() {
  const cwd = process.cwd()
  if (process.platform !== 'win32') {
    return { windowsPath: cwd, wslPath: null, note: 'Path conversion applies on Windows hosts only.' }
  }
  return {
    windowsPath: cwd,
    wslPath: windowsPathToWsl(cwd),
    note: 'For documentation and manual setup — lab files are not mounted into WSL automatically.'
  }
}

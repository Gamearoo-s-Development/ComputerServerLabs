/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export const GITHUB_REPO_URL =
  import.meta.env.VITE_GITHUB_REPO_URL?.trim() || 'https://github.com/Gamearoo-s-Development/ComputerServerLabs'

export const LICENSE_NAME = 'MPL-2.0'
export const LICENSE_URL = 'https://mozilla.org/MPL/2.0/'

/** @type {string | null} */
let cachedDesktopUrl = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL?.trim() || null

export function getDesktopDownloadUrlSync() {
  return cachedDesktopUrl
}

export async function resolveDesktopDownloadUrl() {
  if (cachedDesktopUrl) return cachedDesktopUrl
  try {
    const res = await fetch(`${API_BASE}/api/site/config`, { headers: { Accept: 'application/json' } })
    const data = await res.json()
    if (res.ok && data.desktopDownloadUrl) {
      cachedDesktopUrl = String(data.desktopDownloadUrl)
      return cachedDesktopUrl
    }
  } catch {
    // ignore
  }
  return ''
}

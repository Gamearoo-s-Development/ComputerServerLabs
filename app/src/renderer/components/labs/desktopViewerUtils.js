/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * @param {string | null | undefined} url
 */
export function isAllowedDesktopViewerUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    return host === '127.0.0.1' || host === 'localhost' || host === '[::1]'
  } catch {
    return false
  }
}

/**
 * @param {object | null | undefined} helper
 */
export function desktopWorkstationViewerAvailable(helper) {
  if (!helper) return false
  if (helper.workstationDesktopReady === true) return true
  return (
    typeof helper.workstationProvider === 'string' &&
    helper.workstationProvider.startsWith('desktop-container-')
  )
}

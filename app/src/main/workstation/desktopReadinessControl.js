/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @type {Map<string, { forceReady: boolean }>} */
const activeWaits = new Map()

/**
 * @param {string} sessionId
 */
export function registerDesktopReadinessWait(sessionId) {
  if (!sessionId) return
  activeWaits.set(sessionId, { forceReady: false })
}

/**
 * @param {string} sessionId
 */
export function unregisterDesktopReadinessWait(sessionId) {
  if (!sessionId) return
  activeWaits.delete(sessionId)
}

/**
 * @param {string} sessionId
 */
export function forceDesktopReadiness(sessionId) {
  const entry = activeWaits.get(sessionId)
  if (entry) {
    entry.forceReady = true
    return true
  }
  return false
}

/**
 * @param {string} sessionId
 */
export function isDesktopReadinessForced(sessionId) {
  return activeWaits.get(sessionId)?.forceReady === true
}

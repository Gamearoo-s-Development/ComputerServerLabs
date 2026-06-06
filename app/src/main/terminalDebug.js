/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { logger } from './utils/logger.js'

/** @type {Map<string, { ts: string, step: string, detail?: object }[]>} */
const sessionTraces = new Map()

/**
 * @param {string} sessionId
 */
export function createTerminalTrace(sessionId) {
  if (!sessionTraces.has(sessionId)) {
    sessionTraces.set(sessionId, [])
  }
  const lines = sessionTraces.get(sessionId)

  return {
    log(step, detail = undefined) {
      const entry = {
        ts: new Date().toISOString(),
        step,
        ...(detail !== undefined ? { detail } : {})
      }
      lines.push(entry)
      logger.info('terminal-trace', step, { sessionId, ...(detail ?? {}) })
    },
    getLines() {
      return [...lines]
    }
  }
}

/**
 * @param {string} sessionId
 */
export function getTerminalDebugLog(sessionId) {
  return sessionTraces.get(sessionId) ?? []
}

/**
 * @param {string} sessionId
 */
export function clearTerminalDebugLog(sessionId) {
  sessionTraces.delete(sessionId)
}

/**
 * @param {string} sessionId
 */
export function formatTerminalDebugLog(sessionId) {
  const lines = getTerminalDebugLog(sessionId)
  if (!lines.length) return 'No terminal debug entries yet.'
  return lines
    .map((entry) => {
      const detail = entry.detail ? ` ${JSON.stringify(entry.detail)}` : ''
      return `[${entry.ts}] ${entry.step}${detail}`
    })
    .join('\n')
}

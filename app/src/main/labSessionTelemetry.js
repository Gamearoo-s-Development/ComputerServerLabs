/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { assertSafeSessionId } from './utils/sanitize.js'

/** @type {Map<string, { commands: string[], hintsOpened: number, validationAttempts: number, failedValidations: number }>} */
const sessions = new Map()

const MAX_COMMANDS = 200

/**
 * @param {string} sessionId
 */
export function initSessionTelemetry(sessionId) {
  assertSafeSessionId(sessionId)
  sessions.set(sessionId, {
    commands: [],
    hintsOpened: 0,
    validationAttempts: 0,
    failedValidations: 0
  })
}

/**
 * @param {string} sessionId
 */
export function clearSessionTelemetry(sessionId) {
  sessions.delete(sessionId)
}

/**
 * @param {string} sessionId
 */
export function getSessionTelemetry(sessionId) {
  return sessions.get(sessionId) ?? null
}

/**
 * @param {string} sessionId
 * @param {string} command
 */
export function recordLabCommand(sessionId, command) {
  const row = sessions.get(sessionId)
  if (!row || typeof command !== 'string') return
  const trimmed = command.trim()
  if (!trimmed) return
  row.commands.push(trimmed.slice(0, 500))
  if (row.commands.length > MAX_COMMANDS) {
    row.commands.splice(0, row.commands.length - MAX_COMMANDS)
  }
}

/**
 * @param {string} sessionId
 */
export function recordHintOpened(sessionId) {
  const row = sessions.get(sessionId)
  if (!row) return
  row.hintsOpened += 1
}

/**
 * @param {string} sessionId
 * @param {boolean} passed
 */
export function recordValidationAttempt(sessionId, passed) {
  const row = sessions.get(sessionId)
  if (!row) return
  row.validationAttempts += 1
  if (!passed) row.failedValidations += 1
}

/**
 * @param {string[]} commands
 */
export function summarizeCommands(commands) {
  const counts = new Map()
  for (const raw of commands) {
    const base = raw.split(/\s+/)[0]?.toLowerCase() ?? ''
    if (!base) continue
    counts.set(base, (counts.get(base) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cmd, count]) => ({ cmd, count }))
}

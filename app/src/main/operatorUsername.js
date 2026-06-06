/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import crypto from 'crypto'
import { sanitizeUnixUser } from './utils/sanitize.js'

/** Linux usernames we never generate (also rejected if lab.json suggests them). */
const BANNED_USERNAMES = new Set([
  'student',
  'trainee',
  'admin',
  'root',
  'user',
  'test',
  'guest',
  'operator',
  'player',
  'sysadmin',
  'ubuntu',
  'docker'
])

const PREFIXES = [
  'node',
  'byte',
  'patch',
  'log',
  'kernel',
  'cipher',
  'service',
  'config',
  'grid',
  'stack',
  'proxy',
  'route',
  'mesh',
  'vault',
  'sync',
  'flux',
  'core',
  'data',
  'port',
  'shell'
]

const NOUNS = [
  'fox',
  'warden',
  'rook',
  'runner',
  'moth',
  'otter',
  'hawk',
  'ghost',
  'lynx',
  'crab',
  'owl',
  'wolf',
  'finch',
  'crow',
  'drake',
  'spark',
  'shard',
  'bolt',
  'trace',
  'pulse'
]

/**
 * @param {string} candidate
 */
function isValidOperatorUsername(candidate) {
  if (!candidate || candidate.length < 8 || candidate.length > 16) return false
  if (!/^[a-z][a-z0-9]*$/.test(candidate)) return false
  if (BANNED_USERNAMES.has(candidate)) return false
  for (const banned of BANNED_USERNAMES) {
    if (candidate.includes(banned)) return false
  }
  return true
}

/**
 * Game-style per-session operator username (lowercase, 8–16 chars, letter-first).
 * @param {string} [sessionId] optional entropy tie-in
 */
export function generateOperatorUsername(sessionId) {
  const extra = sessionId ? crypto.createHash('sha256').update(sessionId).digest() : crypto.randomBytes(8)

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const prefix = PREFIXES[extra[attempt % extra.length] % PREFIXES.length]
    const noun = NOUNS[extra[(attempt + 7) % extra.length] % NOUNS.length]
    const digits = String(10 + (extra[(attempt + 13) % extra.length] % 90))
    let candidate = `${prefix}${noun}${digits}`
    if (candidate.length > 16) {
      candidate = candidate.slice(0, 16)
    }
    while (candidate.length < 8) {
      candidate += String(extra[(attempt + candidate.length) % extra.length] % 10)
    }
    if (isValidOperatorUsername(candidate)) {
      return sanitizeUnixUser(candidate)
    }
  }

  const fallback = `op${crypto.randomBytes(4).toString('hex').slice(0, 6)}`
  return sanitizeUnixUser(fallback)
}

/**
 * Reject lab.json / profile usernames that look like training defaults.
 * @param {string | undefined | null} username
 */
export function isBannedLabUsername(username) {
  if (!username || typeof username !== 'string') return true
  const normalized = username.trim().toLowerCase()
  if (!normalized) return true
  if (BANNED_USERNAMES.has(normalized)) return true
  for (const banned of BANNED_USERNAMES) {
    if (normalized.includes(banned)) return true
  }
  return false
}

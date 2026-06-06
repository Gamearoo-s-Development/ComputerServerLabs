/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const PREFIX = '[sysadmin-game]'

const SENSITIVE_KEYS =
  /password|secret|token|credential|privatekey|private_key|accesskey|sshkey|authorization|apikey|discord/i

const SENSITIVE_VALUE_PATTERNS = [
  /-----BEGIN [A-Z ]+-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/,
  /\bssh\s+-[a-zA-Z@]/i
]

/**
 * @param {string} key
 * @param {unknown} value
 */
function redactValue(key, value) {
  if (typeof key === 'string' && SENSITIVE_KEYS.test(key)) {
    return '[redacted]'
  }
  if (typeof value === 'string') {
    if (SENSITIVE_KEYS.test(String(key))) return '[redacted]'
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      if (pattern.test(value)) return '[redacted]'
    }
    if (value.length > 200 && /[A-Za-z0-9+/=]{40,}/.test(value)) {
      return '[redacted]'
    }
  }
  return value
}

/**
 * @param {unknown} arg
 * @param {number} depth
 */
function sanitizeLogArg(arg, depth = 0) {
  if (depth > 4) return '[truncated]'
  if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
    /** @type {Record<string, unknown>} */
    const copy = {}
    for (const [k, v] of Object.entries(arg)) {
      if (Array.isArray(v)) {
        copy[k] = v.map((item) => redactValue(k, item))
      } else if (v && typeof v === 'object') {
        copy[k] = sanitizeLogArg(v, depth + 1)
      } else {
        copy[k] = redactValue(k, v)
      }
    }
    return copy
  }
  return arg
}

/**
 * @param {'log' | 'info' | 'warn' | 'error'} level
 * @param {string} scope
 * @param {unknown[]} args
 */
function write(level, scope, args) {
  const tag = scope ? `${PREFIX}:${scope}` : PREFIX
  const sanitized = args.map((arg) => sanitizeLogArg(arg))
  console[level](tag, ...sanitized)
}

export const logger = {
  log: (scope, ...args) => write('log', scope, args),
  info: (scope, ...args) => write('info', scope, args),
  warn: (scope, ...args) => write('warn', scope, args),
  error: (scope, ...args) => write('error', scope, args)
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import crypto from 'crypto'
import { logger } from './utils/logger.js'
import { assertSafeSessionId } from './utils/sanitize.js'

/** @type {Map<string, SessionVariation>} */
const variations = new Map()

/** @type {Map<string, number[]>} */
const sessionHostPorts = new Map()

/** @type {Set<number>} */
const reservedHostPorts = new Set()

/**
 * @typedef {object} SessionVariation
 * @property {string} sessionId
 * @property {string} labId
 * @property {string} seed
 * @property {string} username
 * @property {string} password
 * @property {string} trainingFlag
 * @property {string} [hostnameAlias]
 * @property {{ basename: string, directory: string, fullPath: string }} flagFile
 * @property {object[]} activeDecoys
 * @property {string} [failureMode]
 * @property {string} [failureKind]
 * @property {number} commandGuideSeed
 */

/**
 * @param {string} seed
 */
function createSeededRng(seed) {
  let state = 0
  for (let i = 0; i < seed.length; i += 1) {
    state = (state ^ seed.charCodeAt(i)) >>> 0
    state = Math.imul(state, 0x01000193) >>> 0
  }
  if (state === 0) state = 0x9e3779b9

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * @param {() => number} rng
 * @param {unknown[]} items
 */
function pickOne(rng, items) {
  if (!items.length) return null
  return items[Math.floor(rng() * items.length)]
}

/**
 * @param {() => number} rng
 * @param {unknown[]} items
 * @param {number} min
 * @param {number} max
 */
function pickMany(rng, items, min, max) {
  if (!items.length) return []
  const count = Math.min(items.length, min + Math.floor(rng() * (max - min + 1)))
  const pool = [...items]
  const out = []
  while (out.length < count && pool.length) {
    const idx = Math.floor(rng() * pool.length)
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}

/**
 * @param {() => number} rng
 * @param {number} length
 */
function randomHex(rng, length) {
  const chars = '0123456789ABCDEF'
  let s = ''
  for (let i = 0; i < length; i += 1) {
    s += chars[Math.floor(rng() * chars.length)]
  }
  return s
}

/**
 * @param {() => number} rng
 * @param {string} template
 */
function applyFlagTemplate(rng, template) {
  return template
    .replace(/\{HEX4\}/g, () => randomHex(rng, 4))
    .replace(/\{HEX6\}/g, () => randomHex(rng, 6))
    .replace(/\{NUM2\}/g, () => String(Math.floor(rng() * 90) + 10))
    .replace(/\{NUM3\}/g, () => String(Math.floor(rng() * 900) + 100))
}

const DEFAULT_FLAG_FORMATS = [
  'SGQ-{HEX4}-LINUX',
  'TRAINING-SSH-{HEX4}',
  'LABFLAG-{HEX4}',
  'SYSADMIN-{HEX6}'
]

const DEFAULT_FLAG_LOCATIONS = [
  '/home/${username}/',
  '/opt/training/',
  '/srv/backup/',
  '/var/tmp/'
]

const DEFAULT_DECOY_POOL = [
  { id: 'old_backup', type: 'file', path: '/home/${username}/.old_backup' },
  { id: 'readme', type: 'file', path: '/home/${username}/readme.txt' },
  { id: 'training_log', type: 'log', path: '/var/log/training-warning.log' },
  { id: 'fake_flag', type: 'file', path: '/home/${username}/.old_flag' },
  { id: 'stale_config', type: 'file', path: '/etc/training/stale.conf' },
  { id: 'cron_hint', type: 'log', path: '/var/log/cron-training.log' }
]

/**
 * @param {object} lab
 */
function variationConfig(lab) {
  const v = lab?.variation
  if (v && v.enabled === false) return null
  return v ?? {}
}

/**
 * @param {string} path
 * @param {string} username
 */
function expandPath(path, username) {
  return path.replace(/\$\{username\}/g, username).replace(/\/+/g, '/')
}

/**
 * @param {object} lab
 * @param {string} sessionId
 */
/**
 * @param {object} lab
 * @param {string} sessionId
 * @param {{ username: string, password: string }} missionCredentials
 */
export function createSessionVariation(lab, sessionId, missionCredentials) {
  assertSafeSessionId(sessionId)
  const cfg = variationConfig(lab)
  const seed = crypto.randomBytes(16).toString('hex')
  const rng = createSeededRng(seed)
  const username = missionCredentials.username
  const password = missionCredentials.password

  const flagFormats = cfg?.flags?.formats ?? DEFAULT_FLAG_FORMATS
  const trainingFlag = applyFlagTemplate(rng, pickOne(rng, flagFormats) ?? DEFAULT_FLAG_FORMATS[0])

  const flagBasename = cfg?.flagFile?.basename ?? '.hidden_flag'
  const locationPool = cfg?.flagFile?.locations ?? DEFAULT_FLAG_LOCATIONS
  const flagDir = expandPath(pickOne(rng, locationPool) ?? `/home/${username}/`, username)
  const flagFile = {
    basename: flagBasename,
    directory: flagDir.endsWith('/') ? flagDir : `${flagDir}/`,
    fullPath: `${flagDir.endsWith('/') ? flagDir : `${flagDir}/`}${flagBasename}`
  }

  const decoyPool = cfg?.decoys?.pool ?? lab.redHerrings ?? DEFAULT_DECOY_POOL
  const pickMin = cfg?.decoys?.pickMin ?? 2
  const pickMax = cfg?.decoys?.pickMax ?? Math.min(4, decoyPool.length)
  const activeDecoys = pickMany(rng, decoyPool, pickMin, pickMax).map((d) => ({
    ...d,
    path: expandPath(d.path ?? '', username)
  }))

  let failureMode = null
  let failureKind = null
  const fm = cfg?.failureModes
  if (fm?.modes?.length) {
    failureKind = fm.kind ?? null
    failureMode = pickOne(rng, fm.modes)
  }

  let hostnameAlias = null
  const aliasTemplates = cfg?.hostnameAliases
  if (aliasTemplates?.length) {
    hostnameAlias = applyFlagTemplate(rng, pickOne(rng, aliasTemplates))
  }

  const customFlags = resolveLabCustomFlags(lab, username, rng, trainingFlag)

  /** @type {SessionVariation} */
  const variation = {
    sessionId,
    labId: lab.id,
    seed,
    username,
    password,
    trainingFlag,
    hostnameAlias,
    flagFile,
    activeDecoys,
    failureMode,
    failureKind,
    customFlags,
    commandGuideSeed: Math.floor(rng() * 0xffffffff)
  }

  variations.set(sessionId, variation)
  logger.info('variation', 'Session variation created', {
    sessionId,
    labId: lab.id,
    seed,
    username,
    failureMode,
    decoyCount: activeDecoys.length,
    flagPath: flagFile.fullPath,
    customFlagCount: Object.keys(variation.customFlags ?? {}).length
  })

  return variation
}

/**
 * @param {string} sessionId
 * @param {object} variation
 */
export function restoreSessionVariation(sessionId, variation) {
  assertSafeSessionId(sessionId)
  if (!variation || typeof variation !== 'object') return null
  variations.set(sessionId, { ...variation, sessionId })
  return variations.get(sessionId) ?? null
}

/**
 * @param {string} sessionId
 */
export function getSessionVariation(sessionId) {
  return variations.get(sessionId) ?? null
}

/**
 * @param {object} lab
 * @param {string} username
 * @param {() => number} rng
 * @param {string} trainingFlag
 */
function resolveLabCustomFlags(lab, username, rng, trainingFlag) {
  const defs = Array.isArray(lab?.flags) ? lab.flags : []
  /** @type {Record<string, string>} */
  const customFlags = {}
  for (const def of defs) {
    if (!def?.id) continue
    let value = String(def.value ?? '')
    value = value.replace(/\{\{TARGET_USER\}\}/g, username)
    if (/\{\{RANDOM_FLAG\}\}/.test(value)) {
      const template = pickOne(rng, DEFAULT_FLAG_FORMATS) ?? DEFAULT_FLAG_FORMATS[0]
      value = applyFlagTemplate(rng, value.replace(/\{\{RANDOM_FLAG\}\}/g, template))
    }
    customFlags[def.id] = value
  }
  return customFlags
}

/**
 * @param {string} sessionId
 * @param {'trainingFlag' | 'flagFilename' | 'flagPath' | string} key
 */
export function getSessionVariationSecret(sessionId, key) {
  const v = variations.get(sessionId)
  if (!v) return null
  if (key === 'trainingFlag') return v.trainingFlag
  if (key === 'flagFilename') return v.flagFile.basename
  if (key === 'flagPath') return v.flagFile.fullPath
  if (typeof key === 'string' && key.startsWith('flag:')) {
    const flagId = key.slice(5)
    return v.customFlags?.[flagId] ?? null
  }
  return null
}

/**
 * @param {SessionVariation} variation
 */
export function variationToEnv(variation) {
  const decoyIds = variation.activeDecoys.map((d) => d.id ?? d.path).filter(Boolean)
  /** @type {Record<string, string>} */
  const env = {
    LAB_SESSION_SEED: variation.seed,
    LAB_TRAINING_FLAG: variation.trainingFlag,
    LAB_FLAG_BASENAME: variation.flagFile.basename,
    LAB_FLAG_DIR: variation.flagFile.directory,
    LAB_FLAG_PATH: variation.flagFile.fullPath,
    LAB_ACTIVE_DECOYS: decoyIds.join(','),
    ...(variation.failureMode ? { LAB_FAILURE_MODE: variation.failureMode } : {}),
    ...(variation.failureKind ? { LAB_FAILURE_KIND: variation.failureKind } : {}),
    ...(variation.hostnameAlias ? { LAB_HOSTNAME_ALIAS: variation.hostnameAlias } : {})
  }
  for (const [flagId, value] of Object.entries(variation.customFlags ?? {})) {
    const envKey = `LAB_FLAG_${flagId.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`
    env[envKey] = value
  }
  return env
}

/**
 * @param {string} sessionId
 */
export function getReservedHostPorts() {
  return reservedHostPorts
}

/**
 * @param {string} sessionId
 * @param {{ host: number }[]} ports
 */
export function registerSessionHostPorts(sessionId, ports) {
  const hosts = ports.map((p) => p.host).filter((h) => Number.isFinite(h) && h > 0)
  sessionHostPorts.set(sessionId, hosts)
  for (const h of hosts) {
    reservedHostPorts.add(h)
  }
}

/**
 * @param {string} sessionId
 * @param {{ host: number }[]} ports
 * @returns {boolean}
 */
export function sessionPortsConflict(sessionId, ports) {
  const mine = new Set(sessionHostPorts.get(sessionId) ?? [])
  for (const p of ports) {
    if (!p.host || mine.has(p.host)) continue
    for (const [sid, hosts] of sessionHostPorts.entries()) {
      if (sid !== sessionId && hosts.includes(p.host)) return true
    }
  }
  return false
}

/**
 * @param {string} sessionId
 */
export function clearSessionVariation(sessionId) {
  const hosts = sessionHostPorts.get(sessionId) ?? []
  for (const h of hosts) {
    reservedHostPorts.delete(h)
  }
  sessionHostPorts.delete(sessionId)
  variations.delete(sessionId)
}

/**
 * Public-safe subset for renderer.
 * @param {string} sessionId
 */
export function getSessionVariationSummary(sessionId) {
  const v = variations.get(sessionId)
  if (!v) return null
  return {
    seed: v.seed,
    hostnameAlias: v.hostnameAlias,
    flagFile: { basename: v.flagFile.basename, directory: v.flagFile.directory },
    activeDecoyCount: v.activeDecoys.length,
    failureMode: v.failureMode,
    commandGuideSeed: v.commandGuideSeed,
    dynamic: true
  }
}

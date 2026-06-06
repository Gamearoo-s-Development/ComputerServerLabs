/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import crypto from 'crypto'
import fs from 'fs'
import { getAllSettings } from '../settingsManager.js'
import { getConfigPath } from './paths.js'

export const ALLOWED_VALIDATION_TYPES = new Set([
  'command',
  'fileExists',
  'serviceRunning',
  'httpResponse',
  'portOpen',
  'userExists',
  'permission',
  'packageInstalled',
  'textAnswer'
])

/** Types that may run checks against the host (still localhost-only). */
export const HOST_VALIDATION_TYPES = new Set(['portOpen'])

/** Types validated inside the container via docker exec. */
export const CONTAINER_VALIDATION_TYPES = new Set([
  'command',
  'fileExists',
  'serviceRunning',
  'httpResponse',
  'userExists',
  'permission',
  'packageInstalled'
])

const BLOCKED_COMMAND_BINARIES = new Set([
  'sh',
  'bash',
  'zsh',
  'fish',
  'cmd',
  'powershell',
  'pwsh',
  '/bin/sh',
  '/bin/bash',
  'sudo',
  'su',
  'curl',
  'wget',
  'nc',
  'ncat',
  'python',
  'python3',
  'node',
  'perl',
  'ruby'
])

const SHELL_METACHAR_PATTERN = /[;&|`$<>(){}[\]!#*?~\\]/
const CONTAINER_PATH_PATTERN = /^\/[a-zA-Z0-9/._-]+$/
const SERVICE_NAME_PATTERN = /^[a-zA-Z0-9@._-]+$/
const UNIX_USER_PATTERN = /^[a-z_][a-z0-9_-]*$/
const PACKAGE_NAME_PATTERN = /^[a-zA-Z0-9+._-]+$/
const PERMISSION_MODE_PATTERN = /^[0-7]{3,4}$/
const SAFE_ARG_PATTERN = /^[a-zA-Z0-9/._=@:+,-]+$/

const LAB_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/
const SESSION_ID_PATTERN = /^[a-f0-9]{16}$/

/** @type {object | null} */
let defaultsCache = null

function loadAppDefaults() {
  if (defaultsCache) return defaultsCache
  const file = getConfigPath('app.defaults.json')
  try {
    defaultsCache = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    defaultsCache = {}
  }
  return defaultsCache
}

export function getSafetyModeConfig() {
  const defaults = loadAppDefaults()
  const safety = defaults.safetyMode ?? {}
  const settings = getAllSettings()
  const enabled =
    typeof settings.safetyModeEnabled === 'boolean'
      ? settings.safetyModeEnabled
      : safety.enabledByDefault !== false

  return {
    enabled,
    blockPrivilegedContainers: safety.blockPrivilegedContainers !== false,
    blockHostMounts: safety.blockHostMounts !== false,
    blockHostShellValidation: safety.blockHostShellValidation !== false,
    blockUnknownValidationTypes: safety.blockUnknownValidationTypes !== false
  }
}

/**
 * @param {string} labId
 */
export function assertSafeLabId(labId) {
  if (!labId || typeof labId !== 'string' || !LAB_ID_PATTERN.test(labId)) {
    throw new Error('Invalid lab id')
  }
}

/**
 * @returns {string}
 */
export function createSessionId() {
  return crypto.randomBytes(8).toString('hex')
}

/**
 * @param {string} sessionId
 */
export function assertSafeSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error('Invalid session id')
  }
}

/**
 * @param {string} labId
 * @param {string} sessionId
 */
export function buildContainerName(labId, sessionId) {
  assertSafeLabId(labId)
  assertSafeSessionId(sessionId)
  return `sysadmin-game-${labId}-${sessionId}`
}

/**
 * @param {object} lab
 * @param {{ enabled?: boolean, blockPrivilegedContainers?: boolean, blockHostMounts?: boolean, blockUnknownValidationTypes?: boolean }} [safety]
 */
export function assertLabSafety(lab, safety = getSafetyModeConfig()) {
  if (!safety.enabled) {
    return
  }

  if (safety.blockUnknownValidationTypes && lab.validation?.type) {
    if (!ALLOWED_VALIDATION_TYPES.has(lab.validation.type)) {
      throw new Error(`Validation type "${lab.validation.type}" is not allowlisted`)
    }
  }

  const docker = lab.docker
  if (!docker) return

  if (safety.blockPrivilegedContainers) {
    if (docker.privileged === true) {
      throw new Error('Privileged containers are blocked by Safety Mode')
    }
  }

  if (safety.blockHostMounts) {
    const mounts = docker.volumes ?? docker.mounts ?? docker.binds
    if (Array.isArray(mounts) && mounts.length > 0) {
      throw new Error('Host volume mounts are blocked by Safety Mode')
    }
  }

  if (docker.hostNetwork === true || docker.networkMode === 'host') {
    throw new Error('Host networking is blocked by Safety Mode')
  }

  if (docker.pidMode === 'host' || docker.pid === 'host') {
    throw new Error('Host PID namespace is blocked by Safety Mode')
  }

  if (docker.ipcMode === 'host' || docker.ipc === 'host') {
    throw new Error('Host IPC namespace is blocked by Safety Mode')
  }

  const capAdd = docker.capAdd ?? docker.cap_add
  if (Array.isArray(capAdd) && capAdd.length > 0) {
    throw new Error('Custom Linux capabilities are blocked by Safety Mode')
  }

  if (docker.privileged === true || docker.securityOpt?.includes?.('seccomp=unconfined')) {
    throw new Error('Privileged or unconfined containers are blocked by Safety Mode')
  }

  const devices = docker.devices ?? docker.deviceRequests
  if (devices && (Array.isArray(devices) ? devices.length > 0 : true)) {
    throw new Error('Device mounts are blocked by Safety Mode')
  }

  if (typeof docker.user === 'string' && /^(0|:?0(?::|$))/.test(docker.user.trim())) {
    throw new Error('Running lab containers as root is discouraged and blocked by Safety Mode')
  }
}

/**
 * @param {string} folderName
 * @param {string} labId
 */
export function assertFolderMatchesId(folderName, labId) {
  if (folderName !== labId) {
    throw new Error(`Lab folder "${folderName}" does not match lab id "${labId}"`)
  }
}

/**
 * @param {object} validation
 * @param {{ enabled?: boolean, blockHostShellValidation?: boolean, blockUnknownValidationTypes?: boolean }} [safety]
 */
export function assertValidationAllowed(validation, safety = getSafetyModeConfig()) {
  if (!validation || typeof validation !== 'object') {
    throw new Error('Lab validation block is missing')
  }

  const type = validation.type
  if (!type || typeof type !== 'string') {
    throw new Error('Validation type is required')
  }

  if (safety.blockUnknownValidationTypes !== false && !ALLOWED_VALIDATION_TYPES.has(type)) {
    throw new Error(`Validation type "${type}" is not allowlisted`)
  }

  return type
}

/**
 * @param {string} containerPath
 */
export function sanitizeContainerPath(containerPath) {
  if (!containerPath || typeof containerPath !== 'string') {
    throw new Error('Container path is required')
  }
  const trimmed = containerPath.trim()
  if (!CONTAINER_PATH_PATTERN.test(trimmed) || trimmed.includes('..')) {
    throw new Error('Unsafe container path')
  }
  return trimmed
}

/**
 * @param {string} serviceName
 */
export function sanitizeServiceName(serviceName) {
  if (!serviceName || !SERVICE_NAME_PATTERN.test(serviceName)) {
    throw new Error('Unsafe service name')
  }
  return serviceName
}

/**
 * @param {string} userName
 */
export function sanitizeUnixUser(userName) {
  if (!userName || !UNIX_USER_PATTERN.test(userName)) {
    throw new Error('Unsafe username')
  }
  return userName
}

/**
 * @param {string} packageName
 */
export function sanitizePackageName(packageName) {
  if (!packageName || !PACKAGE_NAME_PATTERN.test(packageName)) {
    throw new Error('Unsafe package name')
  }
  return packageName
}

/**
 * @param {string} mode
 */
export function sanitizePermissionMode(mode) {
  if (!mode || !PERMISSION_MODE_PATTERN.test(mode)) {
    throw new Error('Unsafe permission mode')
  }
  return mode
}

/**
 * @param {string} url
 */
export function sanitizeContainerHttpUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required')
  }
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed')
  }
  const host = parsed.hostname.toLowerCase()
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('HTTP validation is limited to localhost inside the container')
  }
  return parsed.toString()
}

/**
 * @param {string[]} argv
 */
export function sanitizeExecArgv(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || argv.length > 16) {
    throw new Error('Command must be a non-empty argv array (max 16 args)')
  }

  return argv.map((arg, index) => {
    if (typeof arg !== 'string' || arg.length === 0 || arg.length > 200) {
      throw new Error('Invalid command argument')
    }
    if (SHELL_METACHAR_PATTERN.test(arg)) {
      throw new Error('Shell metacharacters are not allowed in command arguments')
    }
    if (!SAFE_ARG_PATTERN.test(arg)) {
      throw new Error('Unsafe command argument characters')
    }
    if (index === 0) {
      const base = arg.includes('/') ? arg.split('/').pop() : arg
      if (BLOCKED_COMMAND_BINARIES.has(base) || BLOCKED_COMMAND_BINARIES.has(arg)) {
        throw new Error(`Command binary "${base}" is not allowed`)
      }
    }
    return arg
  })
}

/**
 * @param {number} port
 */
export function sanitizePort(port) {
  const n = Number(port)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error('Invalid port number')
  }
  return n
}

/**
 * @param {string} answer
 */
export function normalizeTextAnswer(answer) {
  return String(answer ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * @param {string} answer
 * @param {string[]} acceptedAnswers
 */
export function matchTextAnswer(answer, acceptedAnswers) {
  const normalized = normalizeTextAnswer(answer)
  if (!normalized) return false
  return (acceptedAnswers ?? []).some((item) => normalizeTextAnswer(item) === normalized)
}

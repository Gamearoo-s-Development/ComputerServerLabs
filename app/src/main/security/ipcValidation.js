/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Ajv from 'ajv'
import { assertSafeLabId, assertSafeSessionId } from '../utils/sanitize.js'
import { logger } from '../utils/logger.js'

export class IpcValidationError extends Error {
  /**
   * @param {string} message
   * @param {string} [field]
   */
  constructor(message, field) {
    super(message)
    this.name = 'IpcValidationError'
    this.field = field
  }
}

const ajv = new Ajv({ allErrors: true, coerceTypes: true, removeAdditional: 'all' })

const MAX_STRING = 4096
const MAX_SETTINGS_KEYS = 32
const MAX_TERMINAL_WRITE = 32 * 1024
const schemas = {
  labId: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$' },
  sessionId: { type: 'string', pattern: '^[a-f0-9]{16}$' },
  terminalId: { type: 'string', pattern: '^[a-f0-9]{16,32}$' },
  toolId: { type: 'string', maxLength: 64, pattern: '^[a-zA-Z0-9._-]+$' },
  docId: {
    type: 'string',
    enum: [
      'security-model',
      'creating-labs',
      'lab-builder',
      'security-hardening',
      'threat-model',
      'windows-build',
      'security-electron-notes'
    ]
  },
  url: { type: 'string', maxLength: 2048, pattern: '^https?:\\/\\/' },
  draftId: { type: 'string', pattern: '^[a-f0-9-]{8,64}$' },
  questionId: { type: 'string', maxLength: 120, pattern: '^[a-zA-Z0-9._-]+$' },
  objectiveId: { type: 'string', maxLength: 120, pattern: '^[a-zA-Z0-9._-]+$' },
  discordPage: {
    type: 'string',
    enum: [
      'dashboard',
      'labs',
      'progress',
      'achievements',
      'settings',
      'command-guide',
      'tools',
      'lab-builder',
      'setup/docker'
    ]
  },
  discordContext: { type: 'string', enum: ['terminal', 'intel', 'builder'] },
  settingsPatch: {
    type: 'object',
    maxProperties: MAX_SETTINGS_KEYS,
    additionalProperties: false,
    properties: {
      theme: { type: 'string', enum: ['dark', 'light'] },
      safetyModeEnabled: { type: 'boolean' },
      discordRpcEnabled: { type: 'boolean' },
      reducedAnimations: { type: 'boolean' },
      mockValidationModeDevOnly: { type: 'boolean' },
      ambientAudio: { type: 'boolean' },
      keepLabImagesCache: { type: 'boolean' },
      developerMode: { type: 'boolean' },
      showLabDebugInfo: { type: 'boolean' },
      labBuilderUnsafeOverride: { type: 'boolean' },
      allowLocalTerminalWorkstation: { type: 'boolean' },
      allowWslLocalTerminalWorkstation: { type: 'boolean' },
      localTerminalRiskAcknowledged: { type: 'boolean' },
      wslLocalTerminalRiskAcknowledged: { type: 'boolean' },
      disclaimerAccepted: { type: 'boolean' },
      requireLabStartWarning: { type: 'boolean' },
      requireDestroyConfirmation: { type: 'boolean' },
      onboardingCompleted: { type: 'boolean' },
      onboardingComplete: { type: 'boolean' },
      windowsSetupComplete: { type: 'boolean' },
      labWorkstationPreference: {
        type: 'string',
        enum: [
          'auto',
          'ubuntu-terminal',
          'debian-terminal',
          'windows-terminal',
          'windows-desktop',
          'desktop-container-ubuntu',
          'desktop-container-debian',
          'desktop-container-kali',
          'desktop-container-windows'
        ]
      },
      labWorkstationProfile: {
        type: 'string',
        enum: [
          'auto',
          'ubuntu-terminal',
          'debian-terminal',
          'windows-terminal',
          'windows-desktop',
          'desktop-container-ubuntu',
          'desktop-container-debian',
          'desktop-container-kali',
          'desktop-container-windows',
          'ubuntu-workstation',
          'debian-workstation',
          'alpine-workstation',
          'kali-workstation',
          'windows-workstation'
        ]
      },
      displayName: { type: 'string', maxLength: 64 },
      rankTitle: { type: 'string', maxLength: 64 }
    }
  },
  discordPresence: {
    type: 'object',
    additionalProperties: false,
    maxProperties: 8,
    properties: {
      page: {
        type: 'string',
        enum: [
          'dashboard',
          'labs',
          'progress',
          'achievements',
          'settings',
          'command-guide',
          'tools',
          'lab-builder',
          'setup/docker'
        ]
      },
      context: { type: 'string', enum: ['terminal', 'intel', 'builder'] },
      labTitle: { type: 'string', maxLength: 120 },
      completedLab: { type: 'string', maxLength: 120 }
    }
  },
  terminalResize: {
    type: 'object',
    additionalProperties: false,
    properties: {
      cols: { type: 'integer', minimum: 20, maximum: 500 },
      rows: { type: 'integer', minimum: 5, maximum: 200 }
    }
  },
  dataReset: {
    type: 'object',
    additionalProperties: false,
    required: ['confirmed'],
    properties: {
      confirmed: { type: 'boolean', const: true },
      keepSettings: { type: 'boolean' }
    }
  },
  profilePatch: {
    type: 'object',
    maxProperties: 24,
    additionalProperties: false,
    properties: {
      displayName: { type: 'string', maxLength: 64 },
      avatarInitials: { type: 'string', maxLength: 4 },
      rankTitle: { type: 'string', maxLength: 64 },
      onboardingCompleted: { type: 'boolean' },
      onboardingComplete: { type: 'boolean' }
    }
  }
}

/** @type {Map<string, import('ajv').ValidateFunction>} */
const compiled = new Map()

/**
 * @param {string} name
 * @param {object} schema
 */
function getValidator(name, schema) {
  if (!compiled.has(name)) {
    compiled.set(name, ajv.compile(schema))
  }
  return compiled.get(name)
}

/**
 * @param {string} name
 * @param {unknown} value
 */
function assertSchema(name, schema, value) {
  const validate = getValidator(name, schema)
  if (!validate(value)) {
    const detail = validate.errors?.[0]?.message ?? 'Invalid input'
    throw new IpcValidationError(detail, name)
  }
  return value
}

/**
 * @param {unknown} value
 */
export function parseLabId(value) {
  assertSchema('labId', schemas.labId, value)
  assertSafeLabId(value)
  return /** @type {string} */ (value)
}

/**
 * @param {unknown} value
 */
export function parseSessionId(value) {
  assertSchema('sessionId', schemas.sessionId, value)
  assertSafeSessionId(value)
  return /** @type {string} */ (value)
}

/**
 * @param {unknown} value
 */
export function parseTerminalId(value) {
  return /** @type {string} */ (assertSchema('terminalId', schemas.terminalId, value))
}

/**
 * @param {unknown} value
 */
export function parseToolId(value) {
  return /** @type {string} */ (assertSchema('toolId', schemas.toolId, value))
}

/**
 * @param {unknown} value
 */
export function parseDocId(value) {
  return /** @type {string} */ (assertSchema('docId', schemas.docId, value))
}

/**
 * @param {unknown} value
 */
export function parseExternalUrl(value) {
  return /** @type {string} */ (assertSchema('url', schemas.url, value))
}

/**
 * @param {unknown} value
 */
export function parseDraftId(value) {
  return /** @type {string} */ (assertSchema('draftId', schemas.draftId, value))
}

/**
 * @param {unknown} partial
 */
export function parseSettingsPatch(partial) {
  if (partial === undefined || partial === null) {
    throw new IpcValidationError('Settings patch is required', 'settings')
  }
  const parsed = /** @type {Record<string, unknown>} */ (
    assertSchema('settingsPatch', schemas.settingsPatch, partial)
  )
  if ('onboardingComplete' in parsed && !('onboardingCompleted' in parsed)) {
    parsed.onboardingCompleted = parsed.onboardingComplete
  }
  delete parsed.onboardingComplete
  return parsed
}

/**
 * @param {unknown} partial
 */
export function parseProfilePatch(partial) {
  if (partial === undefined || partial === null) {
    throw new IpcValidationError('Profile patch is required', 'profile')
  }
  return /** @type {Record<string, unknown>} */ (
    assertSchema('profilePatch', schemas.profilePatch, partial)
  )
}

/**
 * @param {unknown} payload
 */
export function parseDiscordPresence(payload) {
  const raw = payload && typeof payload === 'object' ? payload : {}
  return /** @type {{ page?: string, context?: string, labTitle?: string, completedLab?: string }} */ (
    assertSchema('discordPresence', schemas.discordPresence, raw)
  )
}

/**
 * @param {unknown} options
 */
export function parseDataResetOptions(options) {
  return /** @type {{ confirmed: true, keepSettings?: boolean }} */ (
    assertSchema('dataReset', schemas.dataReset, options ?? {})
  )
}

/**
 * @param {unknown} data
 */
export function parseTerminalWrite(data) {
  if (typeof data !== 'string') {
    throw new IpcValidationError('Terminal write must be a string', 'data')
  }
  if (data.length > MAX_TERMINAL_WRITE) {
    throw new IpcValidationError(`Terminal write exceeds ${MAX_TERMINAL_WRITE} bytes`, 'data')
  }
  return data
}

/** @param {unknown} text */
export function parseClipboardText(text) {
  return parseTerminalWrite(text)
}

/**
 * @param {unknown} cols
 * @param {unknown} rows
 */
export function parseTerminalResize(cols, rows) {
  const payload = { cols: Number(cols), rows: Number(rows) }
  assertSchema('terminalResize', schemas.terminalResize, payload)
  return payload
}

/**
 * @param {unknown} answer
 */
export function parseShortText(answer, field = 'answer', maxLen = MAX_STRING) {
  if (typeof answer !== 'string') {
    throw new IpcValidationError(`${field} must be a string`, field)
  }
  if (answer.length > maxLen) {
    throw new IpcValidationError(`${field} is too long`, field)
  }
  return answer
}

/**
 * @param {string} channel
 * @param {unknown} err
 */
export function logIpcValidationFailure(channel, err) {
  const message = err instanceof Error ? err.message : String(err)
  logger.warn('ipc', 'Validation rejected', { channel, message })
}

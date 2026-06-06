/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { app } from 'electron'
import fs from 'fs'
import { getConfigPath } from './utils/paths.js'
import { getDatabase } from './db/database.js'
import { logger } from './utils/logger.js'
import {
  getDefaultRegistryBaseUrl,
  isDevRuntime,
  migratePackagedRegistryDefaults
} from './registryDefaults.js'

const DEFAULT_SETTINGS = {
  theme: 'dark',
  safetyModeEnabled: true,
  discordRpcEnabled: true,
  reducedAnimations: false,
  mockValidationModeDevOnly: false,
  ambientAudio: false,
  disclaimerAccepted: false,
  onboardingCompleted: false,
  windowsSetupComplete: false,
  keepLabImagesCache: false,
  developerMode: false,
  showLabDebugInfo: false,
  labBuilderUnsafeOverride: false,
  labWorkstationPreference: 'auto',
  labWorkstationProfile: 'ubuntu-workstation',
  allowLocalTerminalWorkstation: false,
  allowWslLocalTerminalWorkstation: false,
  localTerminalRiskAcknowledged: false,
  wslLocalTerminalRiskAcknowledged: false,
  workstationLoginMode: 'tty-login',
  cloudSyncEnabled: true,
  leaderboardOptIn: false,
  onlineDeviceId: null
}

const ALLOWED_SETTING_KEYS = new Set([
  ...Object.keys(DEFAULT_SETTINGS),
  'requireLabStartWarning',
  'requireDestroyConfirmation',
  'onlineApiBaseUrl',
  'onlineWebsiteBaseUrl',
  'cloudSyncEnabled',
  'leaderboardOptIn',
  'onlineDeviceId'
])

function withRegistryDefaults(settings) {
  const registryBase = getDefaultRegistryBaseUrl()
  return {
    ...settings,
    onlineApiBaseUrl: registryBase,
    onlineWebsiteBaseUrl: registryBase
  }
}

function loadDefaults() {
  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath('app.defaults.json'), 'utf8'))
    return withRegistryDefaults({
      ...DEFAULT_SETTINGS,
      safetyModeEnabled: config.safetyMode?.enabledByDefault !== false,
      discordRpcEnabled: config.discord?.enabledByDefault !== false,
      requireLabStartWarning: config.safetyMode?.requireLabStartWarning !== false,
      requireDestroyConfirmation: config.safetyMode?.requireDestroyConfirmation !== false,
      keepLabImagesCache: config.docker?.keepLabImagesCache === true,
      workstationLoginMode:
        config.workstation?.loginMode === 'auto-login' ||
        config.workstation?.loginMode === 'app-gated' ||
        config.workstation?.loginMode === 'tty-login' ||
        config.workstation?.loginMode === 'none' ||
        config.workstation?.loginMode === 'show-credentials'
          ? config.workstation.loginMode
          : DEFAULT_SETTINGS.workstationLoginMode
    })
  } catch {
    return withRegistryDefaults({
      ...DEFAULT_SETTINGS,
      requireLabStartWarning: true,
      requireDestroyConfirmation: true,
      keepLabImagesCache: false
    })
  }
}

function parseValue(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function serializeValue(value) {
  return JSON.stringify(value)
}

export function getSetting(key, fallback) {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  if (!row) return fallback
  return parseValue(row.value)
}

export function setSetting(key, value) {
  const db = getDatabase()
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, serializeValue(value))
  return value
}

function syncOnlineRegistryUrls(merged) {
  const defaultBase = getDefaultRegistryBaseUrl()
  let website = String(merged.onlineWebsiteBaseUrl ?? defaultBase).replace(/\/$/, '')
  let api = String(merged.onlineApiBaseUrl ?? defaultBase).replace(/\/$/, '')
  const is8787 = (url) => /:8787(?:\/|$)/.test(url)

  if (is8787(api)) api = is8787(website) ? defaultBase : website
  if (is8787(website)) website = is8787(api) ? defaultBase : api

  const canonical =
    website !== defaultBase && !is8787(website)
      ? website
      : api !== defaultBase && !is8787(api)
        ? api
        : defaultBase

  if (merged.onlineApiBaseUrl !== canonical || merged.onlineWebsiteBaseUrl !== canonical) {
    merged.onlineApiBaseUrl = canonical
    merged.onlineWebsiteBaseUrl = canonical
    setSetting('onlineApiBaseUrl', canonical)
    setSetting('onlineWebsiteBaseUrl', canonical)
  }
}

export function getAllSettings() {
  const defaults = loadDefaults()
  const db = getDatabase()
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const merged = { ...defaults }
  for (const row of rows) {
    merged[row.key] = parseValue(row.value)
  }

  if (merged.onboardingCompleted !== true && merged.onboardingComplete === true) {
    merged.onboardingCompleted = true
    setSetting('onboardingCompleted', true)
  }

  if (app.isPackaged && merged.mockValidationModeDevOnly) {
    merged.mockValidationModeDevOnly = false
  }

  if (app.isPackaged && merged.labBuilderUnsafeOverride) {
    merged.labBuilderUnsafeOverride = false
  }

  if (!isDevRuntime()) {
    merged.mockValidationModeDevOnly = false
  }

  if (!merged.labWorkstationPreference) {
    const legacy = merged.labWorkstationProfile
    if (!legacy || legacy === 'ubuntu-workstation') {
      merged.labWorkstationPreference = 'auto'
    } else if (
      legacy === 'ubuntu-terminal' ||
      legacy === 'debian-terminal' ||
      legacy === 'windows-desktop' ||
      legacy === 'desktop-container-windows'
    ) {
      merged.labWorkstationPreference = legacy === 'windows-desktop' ? 'desktop-container-windows' : legacy
    } else if (legacy === 'windows-terminal' || legacy === 'windows-workstation') {
      merged.labWorkstationPreference = 'desktop-container-windows'
    } else {
      const map = {
        'debian-workstation': 'debian-terminal',
        'alpine-workstation': 'debian-terminal',
        'windows-workstation': 'desktop-container-windows',
        'kali-workstation': 'ubuntu-terminal'
      }
      merged.labWorkstationPreference = map[legacy] ?? 'auto'
    }
  }

  if (
    merged.labWorkstationPreference === 'windows-terminal' ||
    merged.labWorkstationPreference === 'windows-workstation'
  ) {
    merged.labWorkstationPreference = 'desktop-container-windows'
  }

  if (migratePackagedRegistryDefaults(merged)) {
    setSetting('onlineApiBaseUrl', merged.onlineApiBaseUrl)
    setSetting('onlineWebsiteBaseUrl', merged.onlineWebsiteBaseUrl)
  }

  syncOnlineRegistryUrls(merged)

  return merged
}

/** @returns {boolean} */
export function isOnboardingCompleted() {
  const row = getDatabase().prepare('SELECT value FROM settings WHERE key = ?').get('onboardingCompleted')
  if (!row) return false
  return parseValue(row.value) === true
}

/**
 * @param {Record<string, unknown>} partial
 * @param {{ confirmSafetyOff?: boolean }} [options]
 */
export function updateSettings(partial, options = {}) {
  if (!partial || typeof partial !== 'object') {
    throw new Error('Settings payload must be an object')
  }

  if (
    'safetyModeEnabled' in partial &&
    partial.safetyModeEnabled === false &&
    app.isPackaged &&
    !options.confirmSafetyOff
  ) {
    throw new Error('Disabling Safety Mode in production requires explicit confirmation.')
  }

  if ('labBuilderUnsafeOverride' in partial && partial.labBuilderUnsafeOverride && !isDevRuntime()) {
    throw new Error('Lab Builder unsafe override is available in development unpackaged builds only.')
  }

  const updated = { ...getAllSettings() }
  for (const [key, value] of Object.entries(partial)) {
    if (!ALLOWED_SETTING_KEYS.has(key)) {
      logger.warn('settings', 'Ignoring unknown setting key', { key })
      continue
    }
    setSetting(key, value)
    updated[key] = value
  }

  return updated
}

export function resetSettings() {
  const db = getDatabase()
  db.prepare('DELETE FROM settings').run()
  return getAllSettings()
}

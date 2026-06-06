/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { app } from 'electron'
import { LOCAL_REGISTRY_BASE_URL, WEBSITE_URL } from '@sysadmin-game/shared/branding/appBrand.js'

/** @deprecated use LOCAL_REGISTRY_BASE_URL from shared branding */
export const DEFAULT_REGISTRY_BASE_URL = LOCAL_REGISTRY_BASE_URL

const LEGACY_LOCAL_REGISTRY_URLS = new Set([
  LOCAL_REGISTRY_BASE_URL,
  'http://127.0.0.1:8787',
  'http://localhost:8080',
  'http://localhost:8787'
])

export function isDevRuntime() {
  return !app.isPackaged || Boolean(process.env.ELECTRON_RENDERER_URL)
}

/** Registry site URL for new installs: production when packaged, local Docker when developing. */
export function getDefaultRegistryBaseUrl() {
  return isDevRuntime() ? LOCAL_REGISTRY_BASE_URL : WEBSITE_URL
}

/**
 * Point packaged installs at production when they still have dev localhost defaults saved.
 * @param {Record<string, unknown>} settings
 * @returns {boolean} true when settings were updated
 */
export function migratePackagedRegistryDefaults(settings) {
  if (isDevRuntime() || !settings) return false

  const api = String(settings.onlineApiBaseUrl ?? '')
  const website = String(settings.onlineWebsiteBaseUrl ?? '')

  if (!LEGACY_LOCAL_REGISTRY_URLS.has(api) || !LEGACY_LOCAL_REGISTRY_URLS.has(website)) {
    return false
  }

  settings.onlineApiBaseUrl = WEBSITE_URL
  settings.onlineWebsiteBaseUrl = WEBSITE_URL
  return true
}

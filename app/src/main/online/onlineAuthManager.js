/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { shell } from 'electron'
import { DESKTOP_CLIENT_LABEL } from '@sysadmin-game/shared/branding/appBrand.js'
import { getAllSettings, updateSettings } from '../settingsManager.js'
import { getOnlineWebsiteBaseUrl, onlineFetch } from './onlineApiClient.js'
import { saveOnlineSession, clearOnlineSession } from './onlineTokenStore.js'
import { syncProgressToCloudIfLinked } from './onlineProgressSync.js'
import { logger } from '../utils/logger.js'

/** @type {Map<string, { interval: NodeJS.Timeout, resolve: Function, reject: Function }>} */
const activePolls = new Map()

export async function startDeviceLink() {
  const res = await onlineFetch('/api/auth/device/start', {
    method: 'POST',
    body: { clientLabel: DESKTOP_CLIENT_LABEL },
    auth: false
  })
  return {
    deviceCode: res.deviceCode,
    userCode: res.userCode,
    verificationUrl: `${getOnlineWebsiteBaseUrl()}/link-device`,
    expiresAt: res.expiresAt,
    pollIntervalSec: res.pollIntervalSec ?? 5
  }
}

export function openDeviceVerificationUrl(url) {
  if (url) void shell.openExternal(url)
}

/**
 * Poll until approved, expired, or cancelled.
 * @param {string} deviceCode
 * @param {{ pollIntervalSec?: number, timeoutMs?: number }} [options]
 */
export function pollDeviceLink(deviceCode, options = {}) {
  if (activePolls.has(deviceCode)) {
    clearInterval(activePolls.get(deviceCode).interval)
    activePolls.delete(deviceCode)
  }

  const pollIntervalSec = options.pollIntervalSec ?? 5
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000
  const started = Date.now()

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      if (Date.now() - started > timeoutMs) {
        clearInterval(interval)
        activePolls.delete(deviceCode)
        reject(new Error('Device link timed out'))
        return
      }
      try {
        const res = await onlineFetch('/api/auth/device/poll', {
          method: 'POST',
          body: { deviceCode },
          auth: false
        })
        if (res.status === 'approved' && res.accessToken) {
          clearInterval(interval)
          activePolls.delete(deviceCode)
          saveOnlineSession({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            user: res.user
          })
          void syncProgressToCloudIfLinked().catch((error) => {
            logger.warn('onlineAuth', 'Post-link progress sync failed', { error: String(error) })
          })
          resolve({ linked: true, user: res.user })
        } else if (res.status === 'expired') {
          clearInterval(interval)
          activePolls.delete(deviceCode)
          reject(new Error('Device code expired'))
        }
      } catch (error) {
        logger.warn('onlineAuth', 'Device poll error', { error: String(error) })
      }
    }, pollIntervalSec * 1000)

    activePolls.set(deviceCode, { interval, resolve, reject })
  })
}

export function cancelDeviceLink(deviceCode) {
  const poll = activePolls.get(deviceCode)
  if (poll) {
    clearInterval(poll.interval)
    activePolls.delete(deviceCode)
    poll.reject(new Error('Cancelled'))
  }
}

export async function unlinkAccount() {
  clearOnlineSession()
  return { ok: true }
}

export async function updateOnlinePreferences(partial) {
  const settings = getAllSettings()
  const next = {
    cloudSyncEnabled: partial.cloudSyncEnabled ?? settings.cloudSyncEnabled,
    leaderboardOptIn: partial.leaderboardOptIn ?? settings.leaderboardOptIn
  }
  updateSettings(next)
  try {
    if (partial.leaderboardOptIn !== undefined || partial.profilePublic !== undefined) {
      await onlineFetch('/api/account/preferences', {
        method: 'POST',
        body: {
          leaderboardOptIn: next.leaderboardOptIn === true,
          profilePublic: partial.profilePublic === true
        }
      })
    }
    if (partial.notificationPreferences && typeof partial.notificationPreferences === 'object') {
      await onlineFetch('/api/notifications/preferences', {
        method: 'POST',
        body: partial.notificationPreferences
      })
    }
  } catch {
    // preferences saved locally even if offline
  }
  return next
}

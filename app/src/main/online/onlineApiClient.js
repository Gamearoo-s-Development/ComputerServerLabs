/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import os from 'os'
import crypto from 'crypto'
import { getAllSettings } from '../settingsManager.js'
import { logger } from '../utils/logger.js'
import {
  clearOnlineSession,
  getOnlineAccessToken,
  loadOnlineSession,
  saveOnlineSession
} from './onlineTokenStore.js'

/** Public registry site (nginx/Vite). API routes are always /api/* on this origin. */
export const DEFAULT_REGISTRY_BASE_URL = 'http://127.0.0.1:8080'

function stripTrailingSlash(url) {
  return String(url ?? '').replace(/\/$/, '')
}

function isDirectApiPort(url) {
  return /:8787(?:\/|$)/.test(stripTrailingSlash(url))
}

/**
 * Registry site base URL. The desktop app never calls the API container port directly —
 * requests go to `${base}/api/...` through the website reverse proxy.
 */
export function getOnlineRegistryBaseUrl() {
  const settings = getAllSettings()
  let website = stripTrailingSlash(settings.onlineWebsiteBaseUrl ?? DEFAULT_REGISTRY_BASE_URL)
  let api = stripTrailingSlash(settings.onlineApiBaseUrl ?? DEFAULT_REGISTRY_BASE_URL)

  if (isDirectApiPort(api)) {
    api = isDirectApiPort(website) ? DEFAULT_REGISTRY_BASE_URL : website
  }
  if (isDirectApiPort(website)) {
    website = isDirectApiPort(api) ? DEFAULT_REGISTRY_BASE_URL : api
  }

  if (website !== DEFAULT_REGISTRY_BASE_URL && !isDirectApiPort(website)) return website
  if (api !== DEFAULT_REGISTRY_BASE_URL && !isDirectApiPort(api)) return api
  return DEFAULT_REGISTRY_BASE_URL
}

/** @deprecated alias — same as registry site base; paths include /api */
export function getOnlineApiBaseUrl() {
  return getOnlineRegistryBaseUrl()
}

export function getOnlineWebsiteBaseUrl() {
  return getOnlineRegistryBaseUrl()
}

export function getDeviceId() {
  const settings = getAllSettings()
  if (settings.onlineDeviceId) return settings.onlineDeviceId
  const id = crypto.createHash('sha256').update(`${os.hostname()}-${os.userInfo().username}`).digest('hex').slice(0, 32)
  return id
}

/**
 * @param {string} path — must start with /api/
 * @param {{ method?: string, body?: unknown, auth?: boolean, raw?: boolean }} [options]
 */
async function performOnlineFetch(path, options = {}) {
  const url = `${getOnlineRegistryBaseUrl()}${path}`
  /** @type {Record<string, string>} */
  const headers = {
    Accept: 'application/json',
    'X-Device-Id': getDeviceId()
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.auth !== false) {
    const token = getOnlineAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  return fetch(url, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  })
}

/**
 * Exchange refresh token for a new access token. Clears session only when the server
 * rejects the refresh token (not on network errors).
 * @returns {Promise<boolean>} true when access token was renewed
 */
export async function refreshAccessTokenFromStore() {
  const session = loadOnlineSession()
  if (!session?.refreshToken) return false
  const url = `${getOnlineRegistryBaseUrl()}/api/auth/refresh`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken })
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { error: text || res.statusText }
    }
    if (!res.ok) {
      if (res.status === 401) {
        logger.warn('onlineApi', 'Refresh token invalid — clearing local session')
        clearOnlineSession()
      } else {
        logger.warn('onlineApi', 'Refresh failed', { status: res.status, error: data.error })
      }
      return false
    }
    saveOnlineSession({
      accessToken: data.accessToken,
      refreshToken: session.refreshToken,
      user: data.user ?? session.user
    })
    return true
  } catch (error) {
    logger.warn('onlineApi', 'Refresh request failed', { error: String(error) })
    return false
  }
}

/** Refresh access token when a session exists (e.g. before Account page loads). */
export async function ensureOnlineSessionFresh() {
  if (!loadOnlineSession()?.refreshToken) return loadOnlineSession()
  await refreshAccessTokenFromStore()
  return loadOnlineSession()
}

export async function onlineFetch(path, options = {}) {
  const auth = options.auth !== false
  let retried = false

  for (;;) {
    const res = await performOnlineFetch(path, options)
    if (options.raw) return res

    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { error: text || res.statusText }
    }

    if (res.ok) return data

    if (auth && res.status === 401 && !retried) {
      const renewed = await refreshAccessTokenFromStore()
      if (renewed) {
        retried = true
        continue
      }
    }

    const err = new Error(data.error ?? `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
}

/** @deprecated use ensureOnlineSessionFresh */
export async function refreshOnlineSessionIfNeeded() {
  return ensureOnlineSessionFresh()
}

export function getOnlineStatus() {
  const session = loadOnlineSession()
  const settings = getAllSettings()
  const registryBase = getOnlineRegistryBaseUrl()
  return {
    linked: Boolean(session?.accessToken),
    user: session?.user ?? null,
    apiBaseUrl: registryBase,
    websiteBaseUrl: registryBase,
    cloudSyncEnabled: settings.cloudSyncEnabled !== false,
    leaderboardOptIn: settings.leaderboardOptIn === true
  }
}

export async function logoutOnline() {
  const session = loadOnlineSession()
  if (session?.refreshToken) {
    try {
      await onlineFetch('/api/auth/logout', {
        method: 'POST',
        body: { refreshToken: session.refreshToken },
        auth: false
      })
    } catch {
      // ignore
    }
  }
  clearOnlineSession()
  return { ok: true }
}


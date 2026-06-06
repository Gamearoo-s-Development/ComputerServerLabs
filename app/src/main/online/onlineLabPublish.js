/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getDeviceId, getOnlineRegistryBaseUrl } from './onlineApiClient.js'
import { getOnlineAccessToken } from './onlineTokenStore.js'
import { logger } from '../utils/logger.js'

/**
 * Upload a lab pack zip to POST /api/labs/publish (authenticated, server-side safety review).
 * @param {Buffer} zipBuffer
 * @param {string} [changelog]
 */
export async function publishLabPackToRegistry(zipBuffer, changelog = '') {
  const token = getOnlineAccessToken()
  if (!token) {
    throw new Error('Link your account first (Account → Link Account) before publishing labs.')
  }

  const apiBase = getOnlineRegistryBaseUrl()

  const form = new FormData()
  form.append('pack', new Blob([zipBuffer], { type: 'application/zip' }), 'lab-pack.zip')
  if (changelog?.trim()) {
    form.append('changelog', changelog.trim().slice(0, 2000))
  }

  const res = await fetch(`${apiBase}/api/labs/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Device-Id': getDeviceId()
    },
    body: form
  })

  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: text || res.statusText }
  }

  if (!res.ok) {
    const err = new Error(data.error ?? `Publish failed (HTTP ${res.status})`)
    err.status = res.status
    throw err
  }

  logger.info('onlineLabPublish', 'Lab published', { labId: data.labId, version: data.version })
  return data
}

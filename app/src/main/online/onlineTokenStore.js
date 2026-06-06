/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { safeStorage } from 'electron'
import { getUserDataFile } from '../utils/paths.js'
import { logger } from '../utils/logger.js'

const TOKEN_FILE = getUserDataFile('online', 'session.json')
const FALLBACK_KEY_FILE = getUserDataFile('online', '.token-key')

function ensureOnlineDir() {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true })
}

function getFallbackKey() {
  ensureOnlineDir()
  if (fs.existsSync(FALLBACK_KEY_FILE)) {
    return fs.readFileSync(FALLBACK_KEY_FILE)
  }
  const key = crypto.randomBytes(32)
  fs.writeFileSync(FALLBACK_KEY_FILE, key, { mode: 0o600 })
  return key
}

function encryptFallback(text) {
  const iv = crypto.randomBytes(12)
  const key = getFallbackKey()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function decryptFallback(payload) {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const key = getFallbackKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/**
 * Secure token storage — never stores website/email/SMTP passwords.
 */
export function loadOnlineSession() {
  ensureOnlineDir()
  if (!fs.existsSync(TOKEN_FILE)) return null
  try {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf8')
    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(raw, 'base64'))
      return JSON.parse(decrypted)
    }
    return JSON.parse(decryptFallback(raw))
  } catch (error) {
    logger.warn('onlineTokenStore', 'Failed to load session', { error: String(error) })
    return null
  }
}

/** @param {{ accessToken: string, refreshToken?: string, user: object }} session */
export function saveOnlineSession(session) {
  ensureOnlineDir()
  const body = JSON.stringify({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken ?? null,
    user: {
      id: session.user?.id,
      email: session.user?.email,
      displayName: session.user?.displayName ?? session.user?.display_name
    },
    savedAt: new Date().toISOString()
  })
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(body).toString('base64')
    fs.writeFileSync(TOKEN_FILE, encrypted, { mode: 0o600 })
  } else {
    fs.writeFileSync(TOKEN_FILE, encryptFallback(body), { mode: 0o600 })
  }
}

export function clearOnlineSession() {
  ensureOnlineDir()
  if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE)
}

export function getOnlineAccessToken() {
  return loadOnlineSession()?.accessToken ?? null
}

export function getOnlineUser() {
  return loadOnlineSession()?.user ?? null
}

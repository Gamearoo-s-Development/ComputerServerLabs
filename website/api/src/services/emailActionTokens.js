/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import crypto from 'crypto'
import { getDb, newId, nowIso } from '../db/database.js'

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createActionToken() {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * @param {string} userId
 * @param {string} kind
 * @param {number} [ttlMs]
 */
export async function storeActionToken(userId, kind, ttlMs) {
  const db = getDb()
  const token = createActionToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + ttlMs).toISOString()
  await db
    .prepare(
      `INSERT INTO email_action_tokens (id, user_id, kind, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(newId('eat'), userId, kind, tokenHash, expiresAt, nowIso())
  return token
}

/**
 * @param {string} userId
 * @param {'verification' | 'password_reset'} kind
 */
export async function storeEmailActionTokenForUser(userId, kind) {
  const ttlMs = kind === 'verification' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000
  return storeActionToken(userId, kind, ttlMs)
}

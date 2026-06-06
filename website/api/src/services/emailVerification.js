/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import crypto from 'crypto'
import { getDb, nowIso } from '../db/database.js'

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Verify an email action token from the verification link.
 * @param {string} token Plain token from the email URL (never logged).
 */
export async function verifyEmailToken(token) {
  const trimmed = String(token ?? '').trim()
  if (!trimmed) {
    throw new Error('Verification link is missing a token')
  }

  const db = getDb()
  const tokenHash = hashToken(trimmed)
  const row = await db
    .prepare(
      `SELECT * FROM email_action_tokens
       WHERE token_hash = ? AND kind = 'verification'
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(tokenHash)

  if (!row) {
    throw new Error('This verification link is invalid or has already been used')
  }

  if (row.used_at) {
    const user = await db.prepare('SELECT email, display_name, email_verified FROM users WHERE id = ?').get(row.user_id)
    if (user?.email_verified === 1) {
      return {
        email: user.email,
        displayName: user.display_name,
        alreadyVerified: true
      }
    }
    throw new Error('This verification link has already been used')
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error('This verification link has expired. Request a new one from your account settings.')
  }

  const user = await db.prepare('SELECT email, display_name, email_verified FROM users WHERE id = ?').get(row.user_id)
  if (!user) {
    throw new Error('Account not found for this verification link')
  }

  const ts = nowIso()
  if (user.email_verified !== 1) {
    await db.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').run(ts, row.user_id)
  }
  await db.prepare('UPDATE email_action_tokens SET used_at = ? WHERE id = ?').run(ts, row.id)

  return {
    email: user.email,
    displayName: user.display_name,
    alreadyVerified: user.email_verified === 1
  }
}

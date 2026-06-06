/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getDb } from '../db/database.js'
import { verifyAccessToken } from '../utils/crypto.js'

/**
 * Require valid bearer token and active user loaded from DB.
 * Recipient for emails must come from request.dbUser.email only.
 */
export async function authMiddleware(request, reply) {
  const header = request.headers.authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) {
    return reply.code(401).send({ error: 'Missing bearer token' })
  }
  try {
    const payload = await verifyAccessToken(match[1])
    const user = await getDb().prepare('SELECT * FROM users WHERE id = ?').get(payload.sub)
    if (!user) {
      return reply.code(401).send({ error: 'User not found' })
    }
    if (user.disabled === 1) {
      return reply.code(403).send({ error: 'Account disabled' })
    }
    request.user = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      emailVerified: user.email_verified === 1
    }
    request.dbUser = user
    request.deviceId = request.headers['x-device-id'] ? String(request.headers['x-device-id']).slice(0, 128) : null
    request.clientIp = request.ip ?? null
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' })
  }
}

export async function optionalAuth(request) {
  const header = request.headers.authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return
  try {
    const payload = await verifyAccessToken(match[1])
    const user = await getDb().prepare('SELECT * FROM users WHERE id = ?').get(payload.sub)
    if (!user || user.disabled === 1) return
    request.user = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      emailVerified: user.email_verified === 1
    }
    request.dbUser = user
  } catch {
    // ignore
  }
}

export function requireAdmin(request, reply) {
  if (request.user?.role !== 'admin') {
    reply.code(403).send({ error: 'Admin access required' })
    return false
  }
  return true
}

/**
 * Revoke all refresh tokens for the current user (optionally keep current device).
 * @param {string} userId
 * @param {string | null} keepDeviceLabel
 */
export async function revokeUserSessions(userId, keepDeviceLabel = null) {
  const db = getDb()
  if (keepDeviceLabel) {
    await db.prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND device_label != ?').run(userId, keepDeviceLabel)
  } else {
    await db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId)
  }
}

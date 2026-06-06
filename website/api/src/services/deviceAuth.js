/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getDb, newId, nowIso } from '../db/database.js'
import { config } from '../config.js'
import {
  generateDeviceCodes,
  hashPassword,
  hashToken,
  normalizeDeviceUserCode,
  signAccessToken,
  verifyPassword
} from '../utils/crypto.js'
import crypto from 'crypto'

export async function registerUser({ email, password, displayName }) {
  const db = getDb()
  const normalized = String(email).trim().toLowerCase()
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalized)
  if (existing) {
    throw new Error('Email already registered')
  }
  const id = newId('user')
  const ts = nowIso()
  const role = config.adminEmail && normalized === config.adminEmail ? 'admin' : 'user'
  await db
    .prepare(
      `INSERT INTO users (id, email, display_name, password_hash, email_verified, role,
      leaderboard_opt_in, profile_public, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, 0, 0, ?, ?)`
    )
    .run(id, normalized, displayName || normalized.split('@')[0], hashPassword(password), role, ts, ts)
  await db
    .prepare(
      `INSERT INTO notification_preferences (user_id, email_lab_updates, email_new_verified_labs,
      email_lab_completions, email_lab_deployment_ready, email_leaderboard_milestones, email_security_alerts, updated_at)
     VALUES (?, 1, 1, 1, 1, 1, 1, ?)`
    )
    .run(id, ts)
  return db.prepare('SELECT id, email, display_name, role FROM users WHERE id = ?').get(id)
}

export async function loginUser(email, password) {
  const db = getDb()
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase())
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new Error('Invalid email or password')
  }
  return user
}

export async function issueTokens(user, deviceLabel = 'desktop') {
  const db = getDb()
  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.display_name,
    role: user.role
  })
  const refreshToken = crypto.randomBytes(32).toString('base64url')
  const refreshHash = hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + config.jwtRefreshTtlSec * 1000).toISOString()
  await db
    .prepare(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, device_label, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(newId('rt'), user.id, refreshHash, deviceLabel, expiresAt, nowIso())
  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwtAccessTtlSec,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role
    }
  }
}

export async function startDeviceAuth(clientLabel = 'Computer Server Labs Desktop') {
  const db = getDb()
  const { deviceCode, userCode } = generateDeviceCodes()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await db
    .prepare(
      `INSERT INTO device_auth_sessions (device_code, user_code, status, client_label, expires_at, created_at)
     VALUES (?, ?, 'pending', ?, ?, ?)`
    )
    .run(deviceCode, userCode, clientLabel, expiresAt, nowIso())
  return {
    deviceCode,
    userCode,
    verificationUrl: `${config.websiteBaseUrl}/link-device`,
    expiresAt,
    pollIntervalSec: 5
  }
}

export async function approveDeviceAuth(userCode, userId) {
  const db = getDb()
  const normalized = normalizeDeviceUserCode(userCode)
  if (!normalized) throw new Error('Invalid code')
  const session = await db.prepare('SELECT * FROM device_auth_sessions WHERE user_code = ?').get(normalized)
  if (!session) throw new Error('Invalid code')
  if (session.status !== 'pending') throw new Error('Code already used')
  if (new Date(session.expires_at).getTime() < Date.now()) throw new Error('Code expired')
  await db
    .prepare(
      `UPDATE device_auth_sessions SET status = 'approved', user_id = ?, approved_at = ? WHERE user_code = ?`
    )
    .run(userId, nowIso(), normalized)
  return session.device_code
}

export async function pollDeviceAuth(deviceCode) {
  const db = getDb()
  const session = await db.prepare('SELECT * FROM device_auth_sessions WHERE device_code = ?').get(deviceCode)
  if (!session) return { status: 'expired' }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return { status: 'expired' }
  }
  if (session.status === 'pending') {
    return { status: 'pending' }
  }
  if (session.status === 'approved' && session.user_id) {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id)
    const tokens = await issueTokens(user, session.client_label ?? 'desktop')
    await db.prepare("UPDATE device_auth_sessions SET status = 'consumed' WHERE device_code = ?").run(deviceCode)
    return { status: 'approved', ...tokens }
  }
  return { status: 'expired' }
}

export async function refreshAccessToken(refreshToken) {
  const db = getDb()
  const hash = hashToken(refreshToken)
  const row = await db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hash)
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error('Invalid refresh token')
  }
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id)
  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.display_name,
    role: user.role
  })
  return {
    accessToken,
    expiresIn: config.jwtAccessTtlSec,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role
    }
  }
}

export async function revokeRefreshToken(refreshToken) {
  const hash = hashToken(refreshToken)
  await getDb().prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash)
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getDb, newId, nowIso } from '../db/database.js'
import {
  accountTemplateContext,
  resolveAccountForEmail,
  sendAccountEmail
} from './accountEmail.js'
import { sendPasswordResetEmailForAccount, sendVerificationEmailForAccount } from './accountMailActions.js'
import { renderEmailTemplate } from './emailTemplates.js'
import { isNotificationPreferenceEnabled } from './notificationPreferences.js'

/**
 * Events the desktop/website client may POST to /api/notifications/trigger.
 * Server-only events must not appear here.
 */
export const CLIENT_NOTIFICATION_EVENTS = {
  resend_verification: {
    template: 'verification',
    cooldownMs: 5 * 60 * 1000,
    requiresAuth: true,
    allowedContext: []
  },
  password_reset: {
    template: 'password_reset',
    cooldownMs: 10 * 60 * 1000,
    requiresAuth: true,
    allowedContext: []
  },
  lab_update_notifications_enabled: {
    template: 'lab_notifications_enabled',
    cooldownMs: 60 * 1000,
    requiresAuth: true,
    allowedContext: ['enabled']
  },
  security_alert_acknowledge: {
    template: null,
    cooldownMs: 0,
    requiresAuth: true,
    allowedContext: ['alertId'],
    noEmail: true
  },
  lab_deployment_ready: {
    template: 'lab_deployment_ready',
    cooldownMs: 2 * 60 * 1000,
    requiresAuth: true,
    allowedContext: ['labId', 'labTitle']
  },
  lab_completed: {
    template: 'lab_completed',
    cooldownMs: 2 * 60 * 1000,
    requiresAuth: true,
    allowedContext: ['labId', 'labTitle', 'xpEarned', 'bestTimeSec', 'hintsUsed']
  }
}

/** Internal/server-scheduled only — rejected if sent via client trigger API. */
export const SERVER_ONLY_NOTIFICATION_EVENTS = new Set([
  'lab_update',
  'leaderboard_milestone',
  'leaderboard_milestone_notification',
  'security_alert',
  'lab_update_notification'
])

/**
 * @param {string} userId
 * @param {string} event
 * @param {number} cooldownMs
 * @param {string | null} deviceId
 * @param {string | null} ip
 */
export async function checkRateLimit(userId, event, cooldownMs, deviceId, ip) {
  if (!cooldownMs) return { allowed: true }
  const db = getDb()
  const since = new Date(Date.now() - cooldownMs).toISOString()
  const recent = await db
    .prepare(
      `SELECT id FROM email_rate_limits
       WHERE user_id = ? AND event = ? AND sent_at > ?
       ORDER BY sent_at DESC LIMIT 1`
    )
    .get(userId, event, since)
  if (recent) {
    await logEmailAudit({
      userId,
      deviceId,
      event,
      ip,
      rateLimited: true,
      success: false,
      errorCode: 'rate_limited'
    })
    return { allowed: false, retryAfterSec: Math.ceil(cooldownMs / 1000) }
  }
  return { allowed: true }
}

export async function recordRateLimit(userId, event, deviceId, ip) {
  await getDb()
    .prepare(
      `INSERT INTO email_rate_limits (id, user_id, event, device_id, ip, sent_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(newId('rl'), userId, event, deviceId ?? null, ip ?? null, nowIso())
}

/**
 * @param {object} params
 */
export async function logEmailAudit(params) {
  await getDb()
    .prepare(
      `INSERT INTO email_audit_logs (id, user_id, device_id, event, ip, rate_limited, provider, success, error_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      newId('email_audit'),
      params.userId ?? null,
      params.deviceId ?? null,
      params.event,
      params.ip ?? null,
      params.rateLimited ? 1 : 0,
      params.provider ?? null,
      params.success ? 1 : 0,
      params.errorCode ?? null,
      nowIso()
    )
}

/**
 * @param {object} user Row from users table
 * @param {string} event
 * @param {object} [context]
 * @param {{ deviceId?: string | null, ip?: string | null }} meta
 */
export async function triggerClientNotificationEvent(user, event, context = {}, meta = {}) {
  if (SERVER_ONLY_NOTIFICATION_EVENTS.has(event)) {
    throw new Error('This notification event cannot be triggered by clients')
  }

  const spec = CLIENT_NOTIFICATION_EVENTS[event]
  if (!spec) {
    throw new Error('Unknown notification event')
  }

  for (const key of Object.keys(context)) {
    if (!spec.allowedContext.includes(key)) {
      throw new Error(`Context field "${key}" is not allowed for event "${event}"`)
    }
  }

  const rate = await checkRateLimit(user.id, event, spec.cooldownMs, meta.deviceId ?? null, meta.ip ?? null)
  if (!rate.allowed) {
    const err = new Error(`Rate limit exceeded. Try again in ${rate.retryAfterSec} seconds.`)
    err.code = 'RATE_LIMITED'
    err.retryAfterSec = rate.retryAfterSec
    throw err
  }

  const account = await resolveAccountForEmail(user.id)

  if (event === 'security_alert_acknowledge') {
    await recordRateLimit(user.id, event, meta.deviceId ?? null, meta.ip ?? null)
    await logEmailAudit({
      userId: user.id,
      deviceId: meta.deviceId,
      event,
      ip: meta.ip,
      rateLimited: false,
      success: true,
      provider: 'none'
    })
    return { ok: true, event, emailed: false, acknowledged: true, alertId: context.alertId ?? null }
  }

  if (event === 'lab_update_notifications_enabled') {
    const enabled = context.enabled === true
    await getDb()
      .prepare(
        `UPDATE notification_preferences SET email_lab_updates = ?, updated_at = ? WHERE user_id = ?`
      )
      .run(enabled ? 1 : 0, nowIso(), user.id)
    const rendered = renderEmailTemplate('lab_notifications_enabled', accountTemplateContext(account, { enabled }))
    const result = await sendAccountEmail(account, rendered, 'lab_notifications_enabled')
    await recordRateLimit(user.id, event, meta.deviceId ?? null, meta.ip ?? null)
    await logEmailAudit({
      userId: user.id,
      deviceId: meta.deviceId,
      event,
      ip: meta.ip,
      rateLimited: false,
      success: result.ok === true,
      provider: result.provider
    })
    return { ok: true, event, emailed: true }
  }

  if (event === 'resend_verification') {
    const result = await sendVerificationEmailForAccount(account)
    await recordRateLimit(user.id, event, meta.deviceId ?? null, meta.ip ?? null)
    await logEmailAudit({
      userId: user.id,
      deviceId: meta.deviceId,
      event,
      ip: meta.ip,
      rateLimited: false,
      success: result.ok === true,
      provider: result.provider
    })
    return { ok: true, event, emailed: true, sentTo: account.email }
  }

  if (event === 'password_reset') {
    const result = await sendPasswordResetEmailForAccount(account)
    await recordRateLimit(user.id, event, meta.deviceId ?? null, meta.ip ?? null)
    await logEmailAudit({
      userId: user.id,
      deviceId: meta.deviceId,
      event,
      ip: meta.ip,
      rateLimited: false,
      success: result.ok === true,
      provider: result.provider
    })
    return { ok: true, event, emailed: true, sentTo: account.email }
  }

  if (event === 'lab_deployment_ready') {
    const enabled = await isNotificationPreferenceEnabled(user.id, 'email_lab_deployment_ready')
    if (!enabled) {
      await logEmailAudit({
        userId: user.id,
        deviceId: meta.deviceId,
        event,
        ip: meta.ip,
        rateLimited: false,
        success: true,
        provider: 'none',
        errorCode: 'pref_disabled'
      })
      return { ok: true, event, emailed: false, skipped: true, reason: 'preference_disabled' }
    }

    const labId = sanitizeLabIdContext(context.labId)
    const labTitle = sanitizeLabTitleContext(context.labTitle) || labId || 'Lab mission'
    const rendered = renderEmailTemplate(
      'lab_deployment_ready',
      accountTemplateContext(account, { labId, labTitle })
    )
    const result = await sendAccountEmail(account, rendered, 'lab_deployment_ready')
    await recordRateLimit(user.id, event, meta.deviceId ?? null, meta.ip ?? null)
    await logEmailAudit({
      userId: user.id,
      deviceId: meta.deviceId,
      event,
      ip: meta.ip,
      rateLimited: false,
      success: result.ok === true,
      provider: result.provider
    })
    return { ok: true, event, emailed: result.ok === true }
  }

  if (event === 'lab_completed') {
    const enabled = await isNotificationPreferenceEnabled(user.id, 'email_lab_completions')
    if (!enabled) {
      await logEmailAudit({
        userId: user.id,
        deviceId: meta.deviceId,
        event,
        ip: meta.ip,
        rateLimited: false,
        success: true,
        provider: 'none',
        errorCode: 'pref_disabled'
      })
      return { ok: true, event, emailed: false, skipped: true, reason: 'preference_disabled' }
    }

    const labId = sanitizeLabIdContext(context.labId)
    const labTitle = sanitizeLabTitleContext(context.labTitle) || labId || 'Lab mission'
    const xpEarned = Math.max(0, Number(context.xpEarned) || 0)
    const bestTimeSec = context.bestTimeSec != null ? Math.max(0, Number(context.bestTimeSec) || 0) : null
    const hintsUsed = Math.max(0, Number(context.hintsUsed) || 0)
    const rendered = renderEmailTemplate(
      'lab_completed',
      accountTemplateContext(account, { labId, labTitle, xpEarned, bestTimeSec, hintsUsed })
    )
    const result = await sendAccountEmail(account, rendered, 'lab_completed')
    await recordRateLimit(user.id, event, meta.deviceId ?? null, meta.ip ?? null)
    await logEmailAudit({
      userId: user.id,
      deviceId: meta.deviceId,
      event,
      ip: meta.ip,
      rateLimited: false,
      success: result.ok === true,
      provider: result.provider
    })
    return { ok: true, event, emailed: result.ok === true }
  }

  throw new Error('Unhandled notification event')
}

/** @param {unknown} value */
function sanitizeLabIdContext(value) {
  const id = String(value ?? '')
    .trim()
    .slice(0, 64)
  if (!id || !/^[a-zA-Z0-9._-]+$/.test(id)) return ''
  return id
}

/** @param {unknown} value */
function sanitizeLabTitleContext(value) {
  return String(value ?? '')
    .replace(/[\r\n<>]/g, ' ')
    .trim()
    .slice(0, 120)
}

/**
 * Server-internal email dispatch (lab updates, milestones, security alerts).
 * @param {object} user
 * @param {string} templateId
 * @param {object} templateData
 */
export async function sendServerNotificationEmail(user, templateId, templateData = {}) {
  const account = await resolveAccountForEmail(user.id)
  const rendered = renderEmailTemplate(templateId, accountTemplateContext(account, templateData))
  const result = await sendAccountEmail(account, rendered, templateId)
  await logEmailAudit({
    userId: user.id,
    deviceId: null,
    event: `server:${templateId}`,
    ip: null,
    rateLimited: false,
    success: result.ok === true,
    provider: result.provider
  })
  return result
}

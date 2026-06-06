/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getOnlineWebsiteBaseUrl, onlineFetch } from './onlineApiClient.js'

/** Allowed notification trigger events — no raw email fields. */
const ALLOWED_EVENTS = new Set([
  'resend_verification',
  'password_reset',
  'lab_update_notifications_enabled',
  'security_alert_acknowledge',
  'lab_deployment_ready',
  'lab_completed'
])

/**
 * Trigger a predefined server-side notification event.
 * @param {string} event
 * @param {object} [context]
 */
export async function triggerNotificationEvent(event, context = {}) {
  if (!ALLOWED_EVENTS.has(event)) {
    throw new Error(`Notification event not allowed: ${event}`)
  }
  for (const key of Object.keys(context)) {
    if (['to', 'recipient', 'email', 'subject', 'body', 'html', 'text', 'from', 'sender'].includes(key)) {
      throw new Error(`Context field not allowed: ${key}`)
    }
  }
  return onlineFetch('/api/notifications/trigger', {
    method: 'POST',
    body: { event, context: Object.keys(context).length ? context : undefined }
  })
}

export async function getNotificationPreferences() {
  const res = await onlineFetch('/api/notifications/preferences')
  return res.preferences
}

export async function updateNotificationPreferences(preferences) {
  const allowed = {}
  if (preferences.emailLabUpdates !== undefined) allowed.emailLabUpdates = preferences.emailLabUpdates === true
  if (preferences.emailNewVerifiedLabs !== undefined) {
    allowed.emailNewVerifiedLabs = preferences.emailNewVerifiedLabs === true
  }
  if (preferences.emailLabCompletions !== undefined) {
    allowed.emailLabCompletions = preferences.emailLabCompletions === true
  }
  if (preferences.emailLabDeploymentReady !== undefined) {
    allowed.emailLabDeploymentReady = preferences.emailLabDeploymentReady === true
  }
  if (preferences.emailLeaderboardMilestones !== undefined) {
    allowed.emailLeaderboardMilestones = preferences.emailLeaderboardMilestones === true
  }
  if (preferences.emailSecurityAlerts !== undefined) {
    allowed.emailSecurityAlerts = preferences.emailSecurityAlerts === true
  }
  return onlineFetch('/api/notifications/preferences', { method: 'POST', body: allowed })
}

export function getPasswordResetWebsiteUrl() {
  return `${getOnlineWebsiteBaseUrl()}/forgot-password`
}

export async function resendVerificationEmail() {
  return triggerNotificationEvent('resend_verification')
}

export async function requestPasswordResetEmail() {
  return triggerNotificationEvent('password_reset')
}

/**
 * Notify the linked account that a local lab deployment finished and is ready to use.
 * @param {{ labId: string, labTitle?: string }} params
 */
export async function notifyLabDeploymentReady(params) {
  const labId = String(params?.labId ?? '').trim()
  if (!labId) return { ok: false, skipped: true, reason: 'missing_lab_id' }
  const labTitle = String(params?.labTitle ?? labId).trim().slice(0, 120)
  return triggerNotificationEvent('lab_deployment_ready', { labId, labTitle })
}

/**
 * Notify the linked account when a lab is completed for the first time.
 * @param {{ labId: string, labTitle?: string, xpEarned?: number, bestTimeSec?: number | null, hintsUsed?: number }} params
 */
export async function notifyLabCompletedEmail(params) {
  const labId = String(params?.labId ?? '').trim()
  if (!labId) return { ok: false, skipped: true, reason: 'missing_lab_id' }
  const labTitle = String(params?.labTitle ?? labId).trim().slice(0, 120)
  const context = { labId, labTitle }
  if (params?.xpEarned != null) context.xpEarned = Math.max(0, Number(params.xpEarned) || 0)
  if (params?.bestTimeSec != null) context.bestTimeSec = Math.max(0, Number(params.bestTimeSec) || 0)
  if (params?.hintsUsed != null) context.hintsUsed = Math.max(0, Number(params.hintsUsed) || 0)
  return triggerNotificationEvent('lab_completed', context)
}

export async function revokeRemoteSessions() {
  return onlineFetch('/api/auth/revoke-sessions', { method: 'POST', body: {} })
}

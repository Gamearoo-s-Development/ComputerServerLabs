/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { authMiddleware, revokeUserSessions } from '../middleware/auth.js'
import { assertNoForbiddenEmailFields, pickAllowedFields } from '../middleware/requestValidation.js'
import { getDb, nowIso } from '../db/database.js'
import {
  ensureNotificationPreferences,
  mapNotificationPreferences
} from '../services/notificationPreferences.js'
import {
  CLIENT_NOTIFICATION_EVENTS,
  triggerClientNotificationEvent
} from '../services/notificationTrigger.js'
import { processEmailUnsubscribe } from '../services/emailUnsubscribe.js'

const PREFERENCE_KEYS = [
  'emailLabUpdates',
  'emailNewVerifiedLabs',
  'emailLabCompletions',
  'emailLabDeploymentReady',
  'emailLeaderboardMilestones',
  'emailSecurityAlerts'
]

async function handleUnsubscribeRequest(request, reply) {
  const query = request.query ?? {}
  const body = request.body ?? {}
  const token = body.token ?? query.token
  const scope = body.scope ?? query.scope
  try {
    const result = await processEmailUnsubscribe(token, scope)
    return {
      ok: true,
      unsubscribed: true,
      ...result
    }
  } catch (error) {
    return reply.code(400).send({
      error: error instanceof Error ? error.message : 'Unsubscribe failed'
    })
  }
}

export async function notificationRoutes(app) {
  app.get('/api/notifications/unsubscribe', handleUnsubscribeRequest)
  app.post('/api/notifications/unsubscribe', handleUnsubscribeRequest)

  app.get('/api/notifications/preferences', { preHandler: authMiddleware }, async (request) => {
    const row = await ensureNotificationPreferences(request.user.id)
    return {
      ok: true,
      preferences: mapNotificationPreferences(row)
    }
  })

  app.post('/api/notifications/preferences', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      assertNoForbiddenEmailFields(request.body, PREFERENCE_KEYS)
      const p = pickAllowedFields(request.body ?? {}, PREFERENCE_KEYS)
      const current = await ensureNotificationPreferences(request.user.id)
      await getDb()
        .prepare(
          `UPDATE notification_preferences SET
            email_lab_updates = ?,
            email_new_verified_labs = ?,
            email_lab_completions = ?,
            email_lab_deployment_ready = ?,
            email_leaderboard_milestones = ?,
            email_security_alerts = ?,
            updated_at = ?
           WHERE user_id = ?`
        )
        .run(
          p.emailLabUpdates === true ? 1 : p.emailLabUpdates === false ? 0 : current.email_lab_updates,
          p.emailNewVerifiedLabs === true ? 1 : p.emailNewVerifiedLabs === false ? 0 : current.email_new_verified_labs,
          p.emailLabCompletions === true
            ? 1
            : p.emailLabCompletions === false
              ? 0
              : (current.email_lab_completions ?? 1),
          p.emailLabDeploymentReady === true
            ? 1
            : p.emailLabDeploymentReady === false
              ? 0
              : (current.email_lab_deployment_ready ?? 1),
          p.emailLeaderboardMilestones === true
            ? 1
            : p.emailLeaderboardMilestones === false
              ? 0
              : current.email_leaderboard_milestones,
          p.emailSecurityAlerts === true ? 1 : p.emailSecurityAlerts === false ? 0 : current.email_security_alerts,
          nowIso(),
          request.user.id
        )
      return { ok: true }
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Invalid preferences' })
    }
  })

  app.post('/api/notifications/trigger', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      assertNoForbiddenEmailFields(request.body, ['event', 'context'])
      const body = pickAllowedFields(request.body ?? {}, ['event', 'context'])
      const event = body.event
      if (typeof event !== 'string' || !event.trim()) {
        return reply.code(400).send({ error: 'event is required' })
      }
      if (!CLIENT_NOTIFICATION_EVENTS[event]) {
        return reply.code(400).send({ error: 'Unknown or disallowed notification event' })
      }
      const context =
        body.context && typeof body.context === 'object' && !Array.isArray(body.context) ? body.context : {}
      assertNoForbiddenEmailFields(context, CLIENT_NOTIFICATION_EVENTS[event].allowedContext)

      const result = await triggerClientNotificationEvent(request.dbUser, event, context, {
        deviceId: request.deviceId,
        ip: request.clientIp
      })
      return { ok: true, ...result }
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'RATE_LIMITED') {
        return reply.code(429).send({
          error: error.message,
          retryAfterSec: error.retryAfterSec
        })
      }
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Trigger failed' })
    }
  })

  app.post('/api/auth/revoke-sessions', { preHandler: authMiddleware }, async (request) => {
    await revokeUserSessions(request.user.id)
    return { ok: true, revoked: true }
  })
}

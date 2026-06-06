/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { authMiddleware } from '../middleware/auth.js'
import { assertNoForbiddenEmailFields, pickAllowedFields } from '../middleware/requestValidation.js'
import { getAchievementsForUser, getProgressForUser, syncProgress } from '../services/progressSync.js'
import { getDb, nowIso } from '../db/database.js'
import {
  ensureNotificationPreferences,
  mapNotificationPreferences
} from '../services/notificationPreferences.js'

const ACCOUNT_PREF_KEYS = ['leaderboardOptIn', 'profilePublic']

export async function progressRoutes(app) {
  app.post('/api/progress/sync', { preHandler: authMiddleware }, async (request, reply) => {
    const body = request.body ?? {}
    if (!body || typeof body !== 'object') {
      return reply.code(400).send({ error: 'Invalid sync payload' })
    }
    const result = await syncProgress(request.user.id, body)
    return { ok: true, progress: result }
  })

  app.get('/api/progress/me', { preHandler: authMiddleware }, async (request) => {
    return { ok: true, progress: await getProgressForUser(request.user.id) }
  })

  app.get('/api/account/summary', { preHandler: authMiddleware }, async (request) => {
    const db = getDb()
    const userRow = await db
      .prepare(
        'SELECT id, email, display_name, email_verified, role, leaderboard_opt_in, profile_public FROM users WHERE id = ?'
      )
      .get(request.user.id)
    const notifRow = await ensureNotificationPreferences(request.user.id)
    const progress = await getProgressForUser(request.user.id)
    const completedLabs = progress.labs.filter((row) => row.completed === 1).length
    return {
      ok: true,
      user: {
        id: userRow.id,
        email: userRow.email,
        displayName: userRow.display_name,
        emailVerified: userRow.email_verified === 1,
        role: userRow.role
      },
      preferences: {
        leaderboardOptIn: userRow.leaderboard_opt_in === 1,
        profilePublic: userRow.profile_public === 1
      },
      notificationPreferences: mapNotificationPreferences(notifRow),
      progress: {
        ...progress,
        stats: {
          completedLabs,
          achievementCount: progress.achievements.length
        }
      }
    }
  })

  app.get('/api/achievements/me', { preHandler: authMiddleware }, async (request) => {
    return { ok: true, achievements: await getAchievementsForUser(request.user.id) }
  })

  app.post('/api/account/preferences', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      assertNoForbiddenEmailFields(request.body, ACCOUNT_PREF_KEYS)
      const body = pickAllowedFields(request.body ?? {}, ACCOUNT_PREF_KEYS)
      const db = getDb()
      const current = await db.prepare('SELECT leaderboard_opt_in, profile_public FROM users WHERE id = ?').get(request.user.id)
      await db
        .prepare(`UPDATE users SET leaderboard_opt_in = ?, profile_public = ?, updated_at = ? WHERE id = ?`)
        .run(
          body.leaderboardOptIn === true ? 1 : body.leaderboardOptIn === false ? 0 : current.leaderboard_opt_in,
          body.profilePublic === true ? 1 : body.profilePublic === false ? 0 : current.profile_public,
          nowIso(),
          request.user.id
        )
      return { ok: true }
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Invalid preferences' })
    }
  })
}

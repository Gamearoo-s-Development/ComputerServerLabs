/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getDb, nowIso } from '../db/database.js'

/**
 * @param {string} userId
 */
export async function ensureNotificationPreferences(userId) {
  const db = getDb()
  let row = await db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(userId)
  if (row) return row
  const ts = nowIso()
  await db
    .prepare(
      `INSERT INTO notification_preferences (user_id, email_lab_updates, email_new_verified_labs,
      email_lab_completions, email_lab_deployment_ready, email_leaderboard_milestones, email_security_alerts, updated_at)
     VALUES (?, 1, 1, 1, 1, 1, 1, ?)`
    )
    .run(userId, ts)
  row = await db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(userId)
  return row
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapNotificationPreferences(row) {
  return {
    emailLabUpdates: row.email_lab_updates === 1,
    emailNewVerifiedLabs: row.email_new_verified_labs === 1,
    emailLabCompletions: (row.email_lab_completions ?? 1) === 1,
    emailLabDeploymentReady: (row.email_lab_deployment_ready ?? 1) === 1,
    emailLeaderboardMilestones: row.email_leaderboard_milestones === 1,
    emailSecurityAlerts: row.email_security_alerts === 1
  }
}

/**
 * @param {string} userId
 * @param {'email_lab_deployment_ready' | 'email_lab_completions' | 'email_lab_updates' | 'email_new_verified_labs' | 'email_leaderboard_milestones' | 'email_security_alerts'} column
 */
export async function isNotificationPreferenceEnabled(userId, column) {
  const row = await ensureNotificationPreferences(userId)
  return (row[column] ?? 1) === 1
}

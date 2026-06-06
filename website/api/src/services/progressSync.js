/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getDb, newId, nowIso, auditLog } from '../db/database.js'
import {
  achievementInsertSql,
  leaderboardUpsertSql,
  profileUpsertSql,
  progressUpsertSql
} from '../db/dialect.js'
import { createCompletionProof, verifyCompletionProof } from '../utils/crypto.js'
import { notifyLeaderboardMilestonesIfCrossed } from './labNotifications.js'
import { GLOBAL_LEADERBOARD_LAB_ID } from './leaderboardConstants.js'

export async function getProgressForUser(userId) {
  const db = getDb()
  const profile = await db
    .prepare('SELECT xp, level, total_completed FROM user_profile_remote WHERE user_id = ?')
    .get(userId)
  const rows = await db
    .prepare(
      `SELECT lab_id, lab_version, completed, xp_earned, best_time_sec, hints_used, completed_at, updated_at
       FROM progress WHERE user_id = ? ORDER BY updated_at DESC`
    )
    .all(userId)
  const achievements = await db
    .prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ?')
    .all(userId)
  return {
    profile: profile ?? { xp: 0, level: 1, total_completed: 0 },
    labs: rows,
    achievements
  }
}

export async function syncProgress(userId, payload) {
  const db = getDb()
  const ts = nowIso()
  const deviceId = payload.deviceId ?? null

  if (payload.profile) {
    await db
      .prepare(profileUpsertSql())
      .run(
        userId,
        payload.profile.xp ?? 0,
        payload.profile.level ?? 1,
        payload.profile.totalCompleted ?? 0,
        ts
      )
  }

  for (const lab of payload.labs ?? []) {
    if (!lab.labId) continue
    const proofPayload = {
      userId,
      labId: lab.labId,
      labVersion: lab.labVersion,
      completed: lab.completed,
      bestTimeSec: lab.bestTimeSec,
      hintsUsed: lab.hintsUsed,
      xpEarned: lab.xpEarned
    }
    if (lab.completionProof && !verifyCompletionProof(proofPayload, lab.completionProof)) {
      await auditLog(userId, 'progress_sync_rejected', 'progress', lab.labId, { reason: 'invalid_proof' })
      continue
    }

    await db
      .prepare(progressUpsertSql())
      .run(
        newId('prog'),
        userId,
        lab.labId,
        lab.labVersion ?? '1.0.0',
        lab.completed ? 1 : 0,
        lab.xpEarned ?? 0,
        lab.bestTimeSec ?? null,
        lab.hintsUsed ?? 0,
        lab.validationPassed ? 1 : 0,
        lab.verifiedCompletion ? 1 : 0,
        lab.completionProof ?? createCompletionProof(proofPayload),
        deviceId,
        lab.completedAt ?? null,
        ts
      )

  }

  for (const ach of payload.achievements ?? []) {
    if (!ach.achievementId) continue
    await db
      .prepare(achievementInsertSql())
      .run(newId('ach'), userId, ach.achievementId, ach.unlockedAt ?? ts)
  }

  await updateLeaderboardFromProgress(userId)
  return getProgressForUser(userId)
}

async function updateLeaderboardFromProgress(userId) {
  const db = getDb()
  const user = await db
    .prepare('SELECT id, email, display_name, leaderboard_opt_in FROM users WHERE id = ?')
    .get(userId)
  if (!user || user.leaderboard_opt_in !== 1) return

  const existing = await db
    .prepare('SELECT xp FROM leaderboard_entries WHERE user_id = ? AND lab_id = ?')
    .get(userId, GLOBAL_LEADERBOARD_LAB_ID)
  const previousXp = Number(existing?.xp ?? 0)

  const stats = await db
    .prepare(
      `SELECT SUM(xp_earned) AS xp, COUNT(*) AS completed,
              MIN(CASE WHEN best_time_sec > 0 THEN best_time_sec END) AS best_time,
              SUM(hints_used) AS hints
       FROM progress WHERE user_id = ? AND completed = 1 AND verified_completion = 1`
    )
    .get(userId)

  const newXp = Number(stats?.xp ?? 0)

  await db
    .prepare(leaderboardUpsertSql())
    .run(
      newId('lb'),
      userId,
      GLOBAL_LEADERBOARD_LAB_ID,
      user.display_name,
      newXp,
      stats.completed ?? 0,
      stats.best_time ?? null,
      stats.hints ?? 0,
      nowIso()
    )

  void notifyLeaderboardMilestonesIfCrossed(user, previousXp, newXp)
}

export async function getAchievementsForUser(userId) {
  return getDb()
    .prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ?')
    .all(userId)
}

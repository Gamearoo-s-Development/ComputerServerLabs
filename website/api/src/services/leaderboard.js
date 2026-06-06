/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getDb } from '../db/database.js'
import { GLOBAL_LEADERBOARD_LAB_ID } from './leaderboardConstants.js'

/**
 * Normalize legacy NULL lab_id rows and remove duplicate global entries per user.
 */
export async function repairGlobalLeaderboardEntries() {
  const db = getDb()
  const globalRows = await db
    .prepare(
      `SELECT id, user_id, lab_id, xp, updated_at FROM leaderboard_entries
       WHERE lab_id IS NULL OR lab_id = ?`
    )
    .all(GLOBAL_LEADERBOARD_LAB_ID)

  /** @type {Map<string, { id: string, lab_id: string | null, xp: number, updated_at: string }[]>} */
  const byUser = new Map()
  for (const row of globalRows) {
    const list = byUser.get(row.user_id) ?? []
    list.push(row)
    byUser.set(row.user_id, list)
  }

  for (const [, entries] of byUser) {
    entries.sort((a, b) => {
      const xpDiff = Number(b.xp ?? 0) - Number(a.xp ?? 0)
      if (xpDiff !== 0) return xpDiff
      return String(a.updated_at).localeCompare(String(b.updated_at))
    })
    const keeper = entries[0]
    for (let i = 1; i < entries.length; i++) {
      await db.prepare('DELETE FROM leaderboard_entries WHERE id = ?').run(entries[i].id)
    }
    if (keeper && keeper.lab_id !== GLOBAL_LEADERBOARD_LAB_ID) {
      await db
        .prepare('UPDATE leaderboard_entries SET lab_id = ? WHERE id = ?')
        .run(GLOBAL_LEADERBOARD_LAB_ID, keeper.id)
    }
  }
}

/**
 * @param {Record<string, unknown>} row
 * @param {number} rank
 */
function mapGlobalEntry(row, rank) {
  const xp = Number(row.xp ?? 0)
  const level = Number(row.level ?? 1)
  const completedLabs = Number(row.completed_labs ?? 0)
  const totalCompleted = Number(row.total_completed ?? completedLabs)
  const achievementCount = Number(row.achievement_count ?? 0)

  return {
    rank,
    userId: row.user_id,
    displayName: row.display_name,
    display_name: row.display_name,
    xp,
    level,
    completedLabs,
    completed_labs: completedLabs,
    totalCompleted,
    total_completed: totalCompleted,
    achievementCount,
    achievement_count: achievementCount,
    hintsUsed: Number(row.hints_used ?? 0),
    hints_used: Number(row.hints_used ?? 0),
    bestTimeSec: row.best_time_sec ?? null,
    best_time_sec: row.best_time_sec ?? null,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  }
}

export async function getGlobalLeaderboard(limit = 50) {
  const rows = await getDb()
    .prepare(
      `SELECT le.user_id, le.display_name, le.xp, le.completed_labs, le.best_time_sec, le.hints_used, le.updated_at,
              COALESCE(upr.level, 1) AS level,
              COALESCE(upr.total_completed, le.completed_labs) AS total_completed,
              (SELECT COUNT(*) FROM achievements a WHERE a.user_id = le.user_id) AS achievement_count
       FROM leaderboard_entries le
       LEFT JOIN user_profile_remote upr ON upr.user_id = le.user_id
       WHERE le.lab_id = ? AND le.hidden = 0 AND le.verified_only = 1
       ORDER BY le.xp DESC, le.completed_labs DESC, le.updated_at ASC
       LIMIT ?`
    )
    .all(GLOBAL_LEADERBOARD_LAB_ID, limit)

  return rows.map((row, index) => mapGlobalEntry(row, index + 1))
}

export async function getLabLeaderboard(labId, limit = 50) {
  return getDb()
    .prepare(
      `SELECT p.user_id, u.display_name, p.best_time_sec, p.hints_used, p.xp_earned, p.completed_at
       FROM progress p
       JOIN users u ON u.id = p.user_id
       WHERE p.lab_id = ? AND p.completed = 1 AND p.verified_completion = 1
         AND u.leaderboard_opt_in = 1
       ORDER BY p.best_time_sec ASC, p.hints_used ASC
       LIMIT ?`
    )
    .all(labId, limit)
}

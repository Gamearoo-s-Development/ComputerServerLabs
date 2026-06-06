/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { isMariaDb } from './database.js'

export function profileUpsertSql() {
  if (isMariaDb()) {
    return `INSERT INTO user_profile_remote (user_id, xp, level, total_completed, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         xp = GREATEST(xp, VALUES(xp)),
         level = GREATEST(level, VALUES(level)),
         total_completed = GREATEST(total_completed, VALUES(total_completed)),
         updated_at = VALUES(updated_at)`
  }
  return `INSERT INTO user_profile_remote (user_id, xp, level, total_completed, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         xp = MAX(user_profile_remote.xp, excluded.xp),
         level = MAX(user_profile_remote.level, excluded.level),
         total_completed = MAX(user_profile_remote.total_completed, excluded.total_completed),
         updated_at = excluded.updated_at`
}

export function progressUpsertSql() {
  if (isMariaDb()) {
    return `INSERT INTO progress (id, user_id, lab_id, lab_version, completed, xp_earned, best_time_sec,
        hints_used, validation_passed, verified_completion, completion_proof, device_id, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         lab_version = VALUES(lab_version),
         completed = GREATEST(completed, VALUES(completed)),
         xp_earned = GREATEST(xp_earned, VALUES(xp_earned)),
         best_time_sec = CASE
           WHEN best_time_sec IS NULL THEN VALUES(best_time_sec)
           WHEN VALUES(best_time_sec) IS NULL THEN best_time_sec
           ELSE LEAST(best_time_sec, VALUES(best_time_sec))
         END,
         hints_used = VALUES(hints_used),
         validation_passed = GREATEST(validation_passed, VALUES(validation_passed)),
         verified_completion = GREATEST(verified_completion, VALUES(verified_completion)),
         completion_proof = VALUES(completion_proof),
         device_id = VALUES(device_id),
         completed_at = COALESCE(completed_at, VALUES(completed_at)),
         updated_at = VALUES(updated_at)`
  }
  return `INSERT INTO progress (id, user_id, lab_id, lab_version, completed, xp_earned, best_time_sec,
        hints_used, validation_passed, verified_completion, completion_proof, device_id, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, lab_id) DO UPDATE SET
         lab_version = excluded.lab_version,
         completed = MAX(progress.completed, excluded.completed),
         xp_earned = MAX(progress.xp_earned, excluded.xp_earned),
         best_time_sec = CASE
           WHEN progress.best_time_sec IS NULL THEN excluded.best_time_sec
           WHEN excluded.best_time_sec IS NULL THEN progress.best_time_sec
           ELSE MIN(progress.best_time_sec, excluded.best_time_sec)
         END,
         hints_used = excluded.hints_used,
         validation_passed = MAX(progress.validation_passed, excluded.validation_passed),
         verified_completion = MAX(progress.verified_completion, excluded.verified_completion),
         completion_proof = excluded.completion_proof,
         device_id = excluded.device_id,
         completed_at = COALESCE(progress.completed_at, excluded.completed_at),
         updated_at = excluded.updated_at`
}

export function achievementInsertSql() {
  if (isMariaDb()) {
    return `INSERT IGNORE INTO achievements (id, user_id, achievement_id, unlocked_at)
       VALUES (?, ?, ?, ?)`
  }
  return `INSERT OR IGNORE INTO achievements (id, user_id, achievement_id, unlocked_at)
       VALUES (?, ?, ?, ?)`
}

export function leaderboardUpsertSql() {
  if (isMariaDb()) {
    return `INSERT INTO leaderboard_entries (id, user_id, lab_id, display_name, xp, completed_labs,
      best_time_sec, hints_used, verified_only, hidden, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       xp = VALUES(xp),
       completed_labs = VALUES(completed_labs),
       best_time_sec = VALUES(best_time_sec),
       hints_used = VALUES(hints_used),
       updated_at = VALUES(updated_at)`
  }
  return `INSERT INTO leaderboard_entries (id, user_id, lab_id, display_name, xp, completed_labs,
      best_time_sec, hints_used, verified_only, hidden, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
     ON CONFLICT(user_id, lab_id) DO UPDATE SET
       display_name = excluded.display_name,
       xp = excluded.xp,
       completed_labs = excluded.completed_labs,
       best_time_sec = excluded.best_time_sec,
       hints_used = excluded.hints_used,
       updated_at = excluded.updated_at`
}

export function reviewUpsertSql() {
  if (isMariaDb()) {
    return `INSERT INTO lab_reviews (id, lab_id, user_id, rating, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), body = VALUES(body)`
  }
  return `INSERT INTO lab_reviews (id, lab_id, user_id, rating, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(lab_id, user_id) DO UPDATE SET rating = excluded.rating, body = excluded.body`
}

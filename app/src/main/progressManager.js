/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import os from 'os'
import { getDatabase } from './db/database.js'
import {
  diffNewlyUnlockedLabs,
  getProgressionOverview,
  getUnlockedLabIds,
  notifyLabUnlocks
} from './labUnlockManager.js'
import { pushActivity, pushNotification } from './profileManager.js'
import { getAllSettings } from './settingsManager.js'
import { getConfigPath, getUserDataFile } from './utils/paths.js'
import { logger } from './utils/logger.js'

export const ACHIEVEMENT_DEFINITIONS = {
  first_lab: {
    id: 'first_lab',
    title: 'First Steps',
    description: 'Complete your first lab',
    icon: '🎯'
  },
  no_hints: {
    id: 'no_hints',
    title: 'No Hints Needed',
    description: 'Complete a lab without using hints',
    icon: '💡'
  },
  docker_ready: {
    id: 'docker_ready',
    title: 'Container Captain',
    description: 'Docker engine detected and running',
    icon: '🐳'
  },
  five_labs: {
    id: 'five_labs',
    title: 'Lab Runner',
    description: 'Complete five different labs',
    icon: '🗺️'
  },
  validation_master: {
    id: 'validation_master',
    title: 'Lab Master',
    description: 'Pass ten lab submissions',
    icon: '✅'
  },
  linux_basics_complete: {
    id: 'linux_basics_complete',
    title: 'Linux Basics Graduate',
    description: 'Complete First Linux Login and File Permissions Repair',
    icon: '🐧'
  },
  networking_intro: {
    id: 'networking_intro',
    title: 'Networking Intro',
    description: 'Complete the Broken NGINX lab',
    icon: '🌐'
  }
}

function nowIso() {
  return new Date().toISOString()
}

function loadXpConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath('app.defaults.json'), 'utf8'))
    return {
      hintPenaltyPerHint: config.xp?.hintPenaltyPerHint ?? 10,
      minimumXpReward: config.xp?.minimumXpReward ?? 10,
      levels: config.levels ?? [{ level: 1, xpRequired: 0 }]
    }
  } catch {
    return {
      hintPenaltyPerHint: 10,
      minimumXpReward: 10,
      levels: [{ level: 1, xpRequired: 0 }]
    }
  }
}

export function previewLabXp(baseXp, hintsUsed = 0) {
  const { hintPenaltyPerHint, minimumXpReward } = loadXpConfig()
  const penalty = Math.max(0, hintsUsed) * hintPenaltyPerHint
  return Math.max(minimumXpReward, baseXp - penalty)
}

function computeLevelForXp(xp, levels) {
  const sorted = [...levels].sort((a, b) => b.xpRequired - a.xpRequired)
  const match = sorted.find((entry) => xp >= entry.xpRequired)
  return match?.level ?? 1
}

function ensureProfileRow() {
  const db = getDatabase()
  const existing = db.prepare('SELECT id FROM user_profile WHERE id = 1').get()
  if (!existing) {
    const ts = nowIso()
    db.prepare(
      `INSERT INTO user_profile (id, xp, level, total_completed, validation_passes, created_at, updated_at)
       VALUES (1, 0, 1, 0, 0, ?, ?)`
    ).run(ts, ts)
  }
}

export function getProfileRow() {
  ensureProfileRow()
  return getDatabase().prepare('SELECT * FROM user_profile WHERE id = 1').get()
}

export function getProfile() {
  const row = getProfileRow()
  return {
    username: os.userInfo().username || 'Player',
    xp: row.xp,
    level: row.level,
    totalCompleted: row.total_completed,
    validationPasses: row.validation_passes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataStoredUnderUserData: true
  }
}

export function addXp(amount, reason = 'xp') {
  if (!Number.isFinite(amount) || amount <= 0) return getProfile()
  const { levels } = loadXpConfig()
  const db = getDatabase()
  const row = getProfileRow()
  const nextXp = row.xp + amount
  const nextLevel = computeLevelForXp(nextXp, levels)
  db.prepare(
    `UPDATE user_profile SET xp = ?, level = ?, updated_at = ? WHERE id = 1`
  ).run(nextXp, nextLevel, nowIso())
  logger.info('progress', 'XP added', { amount, reason, nextXp, nextLevel })
  return getProfile()
}

export function getLabProgress(labId) {
  return getDatabase().prepare('SELECT * FROM lab_progress WHERE lab_id = ?').get(labId) ?? null
}

export function getAllLabProgress() {
  return getDatabase()
    .prepare('SELECT * FROM lab_progress WHERE completed = 1 ORDER BY completed_at DESC')
    .all()
}

export function getLabProgressList() {
  return getDatabase().prepare('SELECT * FROM lab_progress').all()
}

export function recordLabSession(session) {
  // Intentionally no-op: incomplete lab attempts must not persist to SQLite.
  void session
}

export function getLabSession(sessionId) {
  return getDatabase().prepare('SELECT * FROM lab_sessions WHERE session_id = ?').get(sessionId) ?? null
}

export function updateSessionValidationState(sessionId, state) {
  // Intentionally no-op: validation state is not persisted until lab completion via completeLab().
  void sessionId
  void state
}

export function endLabSession(sessionId) {
  deleteIncompleteLabSession(sessionId)
}

/**
 * @param {string} [sessionId]
 * @returns {number}
 */
export function deleteIncompleteLabSession(sessionId) {
  const db = getDatabase()
  if (sessionId) {
    return db
      .prepare(
        `DELETE FROM lab_sessions
         WHERE session_id = ?
           AND (validation_state IS NULL OR validation_state != 'passed')`
      )
      .run(sessionId).changes
  }
  return 0
}

/**
 * Remove any legacy incomplete session rows left from older builds.
 * @returns {number}
 */
export function purgeIncompleteLabSessions() {
  return getDatabase()
    .prepare(
      `DELETE FROM lab_sessions
       WHERE validation_state IS NULL OR validation_state != 'passed' OR ended_at IS NULL`
    )
    .run().changes
}

export function incrementValidationPasses() {
  const db = getDatabase()
  db.prepare(
    `UPDATE user_profile SET validation_passes = validation_passes + 1, updated_at = ? WHERE id = 1`
  ).run(nowIso())
  return getProfileRow().validation_passes
}

export function unlockAchievement(achievementId) {
  if (!ACHIEVEMENT_DEFINITIONS[achievementId]) return null
  const db = getDatabase()
  const existing = db.prepare('SELECT * FROM achievements WHERE achievement_id = ?').get(achievementId)
  if (existing) return { ...existing, alreadyUnlocked: true }

  const unlockedAt = nowIso()
  db.prepare('INSERT INTO achievements (achievement_id, unlocked_at) VALUES (?, ?)').run(
    achievementId,
    unlockedAt
  )

  const def = ACHIEVEMENT_DEFINITIONS[achievementId]
  pushActivity({
    type: 'achievement',
    message: `Unlocked: ${def.title}`,
    tone: 'success'
  })
  pushNotification({
    title: 'Achievement unlocked',
    body: def.title,
    tone: 'success'
  })

  return { achievement_id: achievementId, unlocked_at: unlockedAt, ...def }
}

export function getAchievements() {
  const unlocked = getDatabase()
    .prepare('SELECT achievement_id, unlocked_at FROM achievements ORDER BY unlocked_at DESC')
    .all()

  const unlockedMap = new Map(unlocked.map((row) => [row.achievement_id, row.unlocked_at]))

  return Object.values(ACHIEVEMENT_DEFINITIONS).map((def) => ({
    ...def,
    unlocked: unlockedMap.has(def.id),
    unlockedAt: unlockedMap.get(def.id) ?? null
  }))
}

function evaluateAchievements({ hintsUsed, totalCompleted, validationPasses, completedLabIds }) {
  if (totalCompleted >= 1) unlockAchievement('first_lab')
  if (hintsUsed === 0 && totalCompleted >= 1) unlockAchievement('no_hints')
  if (totalCompleted >= 5) unlockAchievement('five_labs')
  if (validationPasses >= 10) unlockAchievement('validation_master')
  if (completedLabIds?.has('beginner-linux-001') && completedLabIds?.has('permissions-001')) {
    unlockAchievement('linux_basics_complete')
  }
  if (completedLabIds?.has('nginx-001')) {
    unlockAchievement('networking_intro')
  }
}

export function unlockDockerReadyAchievement() {
  return unlockAchievement('docker_ready')
}

/**
 * @param {string} labId
 * @param {number} baseXp
 * @param {number} [hintsUsed]
 * @param {number} [durationSec]
 */
export function completeLab(labId, baseXp, hintsUsed = 0, durationSec = null) {
  const existing = getLabProgress(labId)
  const row = getProfileRow()

  if (existing?.completed === 1) {
    let bestTime = existing.best_time_sec ?? null
    if (durationSec != null) {
      const improved = bestTime == null || durationSec < bestTime
      if (improved) {
        bestTime = durationSec
        getDatabase()
          .prepare('UPDATE lab_progress SET best_time_sec = ? WHERE lab_id = ?')
          .run(bestTime, labId)
      }
    }

    return {
      xpAwarded: 0,
      totalXp: row.xp,
      level: row.level,
      totalCompleted: row.total_completed,
      bestTimeSec: bestTime,
      alreadyCompleted: true
    }
  }

  const xpAwarded = previewLabXp(baseXp, hintsUsed)
  const { levels } = loadXpConfig()
  const db = getDatabase()
  const previousLevel = row.level
  const unlockedBefore = getUnlockedLabIds()
  const nextXp = row.xp + xpAwarded
  const nextLevel = computeLevelForXp(nextXp, levels)

  let bestTime = existing?.best_time_sec ?? null
  if (durationSec != null) {
    bestTime = bestTime != null ? Math.min(bestTime, durationSec) : durationSec
  }
  const totalXpForLab = (existing?.xp_earned ?? 0) + xpAwarded

  if (existing) {
    db.prepare(
      `UPDATE lab_progress SET completed = 1, best_time_sec = ?, hints_used = ?, xp_earned = ?, completed_at = ?
       WHERE lab_id = ?`
    ).run(bestTime, hintsUsed, totalXpForLab, nowIso(), labId)
  } else {
    db.prepare(
      `INSERT INTO lab_progress (lab_id, completed, best_time_sec, hints_used, xp_earned, completed_at)
       VALUES (?, 1, ?, ?, ?, ?)`
    ).run(labId, bestTime, hintsUsed, xpAwarded, nowIso())
  }

  const totalCompleted = db
    .prepare('SELECT COUNT(*) AS c FROM lab_progress WHERE completed = 1')
    .get().c

  db.prepare(
    `UPDATE user_profile SET xp = ?, level = ?, total_completed = ?, updated_at = ? WHERE id = 1`
  ).run(nextXp, nextLevel, totalCompleted, nowIso())

  pushActivity({
    type: 'lab',
    message: `Completed ${labId} (+${xpAwarded} XP)`,
    tone: 'success'
  })
  pushNotification({
    title: 'Lab complete',
    body: `+${xpAwarded} XP gained`,
    tone: 'success'
  })

  const profile = getProfileRow()
  const completedLabIds = new Set(
    db.prepare('SELECT lab_id FROM lab_progress WHERE completed = 1').all().map((r) => r.lab_id)
  )
  evaluateAchievements({
    hintsUsed,
    totalCompleted,
    validationPasses: profile.validation_passes,
    completedLabIds
  })

  const unlockedAfter = getUnlockedLabIds()
  const newlyUnlockedLabs = diffNewlyUnlockedLabs(unlockedBefore, unlockedAfter)
  const levelIncreased = nextLevel > previousLevel
  notifyLabUnlocks(newlyUnlockedLabs, { levelIncreased, newLevel: nextLevel })

  return {
    xpAwarded,
    totalXp: nextXp,
    level: nextLevel,
    previousLevel,
    levelIncreased,
    totalCompleted,
    bestTimeSec: bestTime,
    alreadyCompleted: false,
    newlyUnlockedLabs
  }
}

export function getStats() {
  const profile = getProfileRow()
  const completedLabs = getAllLabProgress()
  const achievements = getAchievements()
  const unlockedCount = achievements.filter((a) => a.unlocked).length

  return {
    xp: profile.xp,
    level: profile.level,
    totalCompleted: profile.total_completed,
    validationPasses: profile.validation_passes,
    completedLabs: completedLabs.map((row) => ({
      labId: row.lab_id,
      bestTimeSec: row.best_time_sec,
      hintsUsed: row.hints_used,
      xpEarned: row.xp_earned,
      completedAt: row.completed_at
    })),
    achievementsUnlocked: unlockedCount,
    achievementsTotal: achievements.length
  }
}

export function resetProgress() {
  const db = getDatabase()
  db.exec(`
    DELETE FROM lab_progress;
    DELETE FROM lab_sessions;
    DELETE FROM achievements;
    DELETE FROM question_attempts;
    UPDATE user_profile SET xp = 0, level = 1, total_completed = 0, validation_passes = 0, updated_at = datetime('now') WHERE id = 1;
  `)
  pushActivity({ type: 'system', message: 'Progress reset', tone: 'warning' })
  return getStats()
}

export function migrateFromLegacyProfile() {
  const legacyPath = getUserDataFile('profile.json')
  if (!fs.existsSync(legacyPath)) return

  try {
    const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8'))
    const row = getProfileRow()
    if (row.xp > 0) return

    if (legacy.xp > 0) {
      const { levels } = loadXpConfig()
      const level = computeLevelForXp(legacy.xp, levels)
      getDatabase()
        .prepare(
          `UPDATE user_profile SET xp = ?, level = ?, total_completed = ?, updated_at = ? WHERE id = 1`
        )
        .run(legacy.xp, level, legacy.completedLabs?.length ?? 0, nowIso())

      for (const labId of legacy.completedLabs ?? []) {
        getDatabase()
          .prepare(
            `INSERT OR IGNORE INTO lab_progress (lab_id, completed, xp_earned, completed_at)
             VALUES (?, 1, 0, ?)`
          )
          .run(labId, nowIso())
      }
      logger.info('progress', 'Migrated legacy profile.json into SQLite')
    }
  } catch (error) {
    logger.warn('progress', 'Legacy profile migration skipped', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

export function getRankForLevel(level, ranks) {
  const sorted = [...ranks].sort((a, b) => b.minLevel - a.minLevel)
  const match = sorted.find((r) => level >= r.minLevel)
  return match ?? ranks[0]
}

export function getProgressOverview(ranks, options = {}) {
  const profile = getProfile()
  const stats = getStats()
  const rank = getRankForLevel(profile.level, ranks)
  const { levels, hintPenaltyPerHint, minimumXpReward } = loadXpConfig()
  const nextLevel = levels.find((entry) => entry.level > profile.level)
  const currentLevelXp = levels.find((entry) => entry.level === profile.level)?.xpRequired ?? 0
  const nextLevelXp = nextLevel?.xpRequired ?? profile.xp

  return {
    profile: {
      ...profile,
      activity: [],
      settings: getAllSettings(),
      achievements: getAchievements().filter((a) => a.unlocked)
    },
    stats,
    rank,
    ranks,
    xpMeta: {
      hintPenaltyPerHint,
      minimumXpReward,
      currentLevelXp,
      nextLevelXp,
      xpToNextLevel: Math.max(0, nextLevelXp - profile.xp),
      progressPct:
        nextLevelXp > currentLevelXp
          ? Math.min(100, Math.round(((profile.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100))
          : 100
    },
    progression: getProgressionOverview(
      options.activeLabIds ? { activeLabIds: options.activeLabIds } : undefined
    )
  }
}

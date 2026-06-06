/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getAllSettings } from '../settingsManager.js'
import { getProfile, getAchievements, getLabProgressList } from '../progressManager.js'
import { getDeviceId, getOnlineStatus, onlineFetch } from './onlineApiClient.js'
import { loadOnlineSession } from './onlineTokenStore.js'
import { logger } from '../utils/logger.js'

/**
 * Push local progress to cloud (no terminal output, secrets, or target passwords).
 */
export async function syncProgressToCloud() {
  const settings = getAllSettings()
  if (settings.cloudSyncEnabled === false) {
    return { ok: false, skipped: true, reason: 'Cloud sync disabled' }
  }
  if (!loadOnlineSession()?.accessToken) {
    return { ok: false, skipped: true, reason: 'Account not linked' }
  }

  const profile = getProfile()
  const labRows = getLabProgressList()
  const achievements = getAchievements().filter((a) => a.unlocked)

  const payload = {
    deviceId: getDeviceId(),
    profile: {
      xp: profile.xp,
      level: profile.level,
      totalCompleted: profile.totalCompleted
    },
    labs: labRows.map((row) => ({
      labId: row.lab_id,
      labVersion: '1.0.0',
      completed: row.completed === 1,
      xpEarned: row.xp_earned,
      bestTimeSec: row.best_time_sec,
      hintsUsed: row.hints_used,
      validationPassed: row.completed === 1,
      verifiedCompletion: row.completed === 1,
      completedAt: row.completed_at
    })),
    achievements: achievements.map((a) => ({
      achievementId: a.id,
      unlockedAt: a.unlockedAt
    }))
  }

  try {
    const res = await onlineFetch('/api/progress/sync', { method: 'POST', body: payload })
    logger.info('onlineSync', 'Progress synced', { labs: payload.labs.length })
    return { ok: true, progress: res.progress }
  } catch (error) {
    logger.warn('onlineSync', 'Sync failed', { error: String(error) })
    throw error
  }
}

export async function fetchCloudProgress() {
  const res = await onlineFetch('/api/progress/me')
  return res.progress
}

export async function fetchCloudAchievements() {
  const res = await onlineFetch('/api/achievements/me')
  return res.achievements
}

export async function fetchGlobalLeaderboard() {
  const res = await onlineFetch('/api/leaderboards/global', { auth: false })
  return res.entries ?? []
}

export async function fetchLabLeaderboard(labId) {
  const res = await onlineFetch(`/api/leaderboards/lab/${labId}`, { auth: false })
  return res.entries ?? []
}

/** Sync when linked and cloud sync is enabled (startup, after link, etc.). */
export async function syncProgressToCloudIfLinked() {
  const status = getOnlineStatus()
  if (!status.linked || status.cloudSyncEnabled === false) {
    return { ok: false, skipped: true, reason: 'Not linked or sync disabled' }
  }
  return syncProgressToCloud()
}

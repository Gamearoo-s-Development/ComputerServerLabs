/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getDb } from '../db/database.js'
import { sendServerNotificationEmail } from './notificationTrigger.js'

/**
 * @param {string} userId
 * @param {string} prefColumn
 */
async function userPrefEnabled(userId, prefColumn) {
  const allowed = new Set([
    'email_lab_completions',
    'email_new_verified_labs',
    'email_lab_updates',
    'email_leaderboard_milestones',
    'email_security_alerts'
  ])
  if (!allowed.has(prefColumn)) return false
  const row = await getDb()
    .prepare(`SELECT COALESCE(${prefColumn}, 1) AS enabled FROM notification_preferences WHERE user_id = ?`)
    .get(userId)
  return row?.enabled === 1
}

/**
 * Email the player when they complete a lab (first cloud sync of completion).
 * @param {object} user users row
 * @param {object} lab
 */
export async function notifyLabCompleted(user, lab) {
  if (!user?.email) return
  const enabled = await userPrefEnabled(user.id, 'email_lab_completions')
  if (!enabled) return

  const db = getDb()
  const registryLab = await db.prepare('SELECT title FROM labs WHERE id = ?').get(lab.labId)
  const labTitle = registryLab?.title ?? lab.labId

  try {
    await sendServerNotificationEmail(user, 'lab_completed', {
      labId: lab.labId,
      labTitle,
      labVersion: lab.labVersion ?? '1.0.0',
      xpEarned: lab.xpEarned ?? 0,
      bestTimeSec: lab.bestTimeSec ?? null,
      hintsUsed: lab.hintsUsed ?? 0
    })
  } catch (error) {
    console.warn('[labNotifications] Lab completed email failed', user.id, lab.labId, String(error))
  }
}

/**
 * Notify all opted-in users when a lab is verified and ready in the registry.
 * @param {string} labId
 * @param {string} version
 */
export async function broadcastNewVerifiedLab(labId, version) {
  const db = getDb()
  const lab = await db.prepare('SELECT id, title, description FROM labs WHERE id = ? AND disabled = 0').get(labId)
  if (!lab) return

  const subscribers = await db
    .prepare(
      `SELECT u.id, u.email, u.display_name
       FROM users u
       JOIN notification_preferences p ON p.user_id = u.id
       WHERE p.email_new_verified_labs = 1 AND u.disabled = 0`
    )
    .all()

  for (const user of subscribers) {
    try {
      await sendServerNotificationEmail(user, 'new_verified_lab', {
        labId: lab.id,
        labTitle: lab.title,
        version,
        description: lab.description ?? ''
      })
    } catch (error) {
      console.warn('[labNotifications] New verified lab email failed', user.id, labId, String(error))
    }
  }
}

/**
 * Notify opted-in users when a published lab version is updated.
 * @param {string} labId
 * @param {string} version
 */
export async function broadcastLabUpdate(labId, version) {
  const db = getDb()
  const lab = await db.prepare('SELECT id, title FROM labs WHERE id = ? AND disabled = 0').get(labId)
  if (!lab) return

  const subscribers = await db
    .prepare(
      `SELECT u.id, u.email, u.display_name
       FROM users u
       JOIN notification_preferences p ON p.user_id = u.id
       WHERE p.email_lab_updates = 1 AND u.disabled = 0`
    )
    .all()

  for (const user of subscribers) {
    try {
      await sendServerNotificationEmail(user, 'lab_update', {
        labId: lab.id,
        labTitle: lab.title,
        version
      })
    } catch (error) {
      console.warn('[labNotifications] Lab update email failed', user.id, labId, String(error))
    }
  }
}

const XP_MILESTONES = [500, 1000, 2500, 5000, 10000, 25000]

/**
 * Email when global leaderboard XP crosses a milestone (leaderboard opt-in + email pref).
 * @param {object} user
 * @param {number} previousXp
 * @param {number} newXp
 */
export async function notifyLeaderboardMilestonesIfCrossed(user, previousXp, newXp) {
  if (!user?.email) return
  const enabled = await userPrefEnabled(user.id, 'email_leaderboard_milestones')
  if (!enabled) return

  for (const threshold of XP_MILESTONES) {
    if (previousXp < threshold && newXp >= threshold) {
      try {
        await sendServerNotificationEmail(user, 'leaderboard_milestone', {
          milestone: `You reached ${threshold.toLocaleString()} XP on the global leaderboard!`
        })
      } catch (error) {
        console.warn('[labNotifications] Leaderboard milestone email failed', user.id, threshold, String(error))
      }
    }
  }
}

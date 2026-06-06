/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const XP_LEVELS = [0, 200, 500, 1000, 2000, 3500, 5000]

/**
 * @param {number} xp
 * @param {number} level
 */
export function xpProgressWithinLevel(xp, level) {
  const lvl = Math.max(1, Math.min(level, XP_LEVELS.length))
  const floor = XP_LEVELS[lvl - 1] ?? 0
  const ceiling = XP_LEVELS[lvl] ?? XP_LEVELS[XP_LEVELS.length - 1] + 1500
  if (ceiling <= floor) return { percent: 100, floor, ceiling }
  const percent = Math.min(100, Math.round(((xp - floor) / (ceiling - floor)) * 100))
  return { percent: Math.max(0, percent), floor, ceiling }
}

/**
 * @param {string | null | undefined} name
 */
export function leaderboardInitials(name) {
  const parts = String(name ?? '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

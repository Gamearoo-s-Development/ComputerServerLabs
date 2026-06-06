/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { sortLabsByUnlockOrder } from '@sysadmin-game/shared/lab-format/labUnlockSort.js'

/** @typedef {'all' | 'ready' | 'scaffold' | 'invalid'} LabStatusFilter */
/** @typedef {'all' | 'available' | 'locked' | 'completed' | 'in_progress'} LabProgressionFilter */
/** @typedef {'all' | 'bundled' | 'community' | 'online' | 'installed'} LabSourceFilter */

/**
 * @param {string} difficulty
 */
export function difficultyTone(difficulty) {
  const d = String(difficulty ?? '').toLowerCase()
  if (d === 'easy') return 'easy'
  if (d === 'medium') return 'medium'
  if (d === 'hard') return 'hard'
  if (d === 'expert') return 'expert'
  return 'unknown'
}

/**
 * @param {string} runtime
 */
export function runtimeIcon(runtime) {
  const r = String(runtime ?? '').toLowerCase()
  if (r === 'docker') return '🐳'
  if (r === 'virtualbox') return '📦'
  if (r === 'vmware') return '💻'
  if (r === 'qemu') return '⚙️'
  if (r === 'hyperv') return '🪟'
  return '🔬'
}

/**
 * @param {string} difficulty
 */
export function estimatedMinutesForDifficulty(difficulty) {
  const d = String(difficulty ?? '').toLowerCase()
  if (d === 'easy') return '15–30 min'
  if (d === 'medium') return '30–50 min'
  if (d === 'hard') return '45–75 min'
  if (d === 'expert') return '60–120 min'
  return 'Varies'
}

/**
 * Simple hash for stable gradient colors from a string.
 * @param {string} str
 */
function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/**
 * @param {string} id
 * @param {string} category
 */
export function labThumbnailStyle(id, category) {
  const h = hashString(`${id}|${category}`)
  const hue1 = h % 360
  const hue2 = (hue1 + 40 + (h % 80)) % 360
  return {
    background: `linear-gradient(135deg, hsl(${hue1} 45% 22%) 0%, hsl(${hue2} 50% 14%) 100%)`
  }
}

/**
 * @param {string} title
 */
export function labInitials(title) {
  const words = String(title ?? 'Lab')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  const w = words[0] ?? 'L'
  return w.slice(0, 2).toUpperCase()
}

/**
 * @param {object} lab
 * @returns {LabStatusFilter}
 */
export function labStatusBucket(lab) {
  if (!lab.valid) return 'invalid'
  if (lab.runnable) return 'ready'
  return 'scaffold'
}

/**
 * @param {object} lab
 * @returns {LabProgressionFilter | 'invalid'}
 */
export function labProgressionBucket(lab) {
  if (!lab.valid) return 'invalid'
  if (lab.progressState === 'completed') return 'completed'
  if (lab.progressState === 'in_progress') return 'in_progress'
  if (lab.locked || lab.unlocked === false) return 'locked'
  return 'available'
}

/**
 * @param {object} lab
 */
export function formatUnlockRequirements(lab) {
  const lines = []
  const req = lab.unlockRequirements
  const minLevel = req?.minLevel ?? lab.minUnlockLevel
  if (minLevel && minLevel > 1) {
    lines.push(`Unlocks at Level ${minLevel}`)
  } else if (lab.locked) {
    lines.push('Complete prerequisites to unlock')
  }

  const missingLabs = (lab.missingRequirements ?? []).filter((m) => m.type === 'lab')
  if (missingLabs.length > 0) {
    lines.push('Complete:')
    for (const item of missingLabs) {
      lines.push(`- ${item.label}`)
    }
  } else if (Array.isArray(req?.requiredLabs) && req.requiredLabs.length > 0 && lab.locked) {
    lines.push('Complete earlier labs in the catalog')
  }

  const missingAchievements = (lab.missingRequirements ?? []).filter((m) => m.type === 'achievement')
  if (missingAchievements.length > 0) {
    lines.push('Achievements:')
    for (const item of missingAchievements) {
      lines.push(`- ${item.label}`)
    }
  }

  if (lab.unlockSummary) {
    return lab.unlockSummary.split('\n')
  }

  return lines
}

/**
 * @param {object[]} labs
 * @param {{
 *   search: string
 *   difficulty: string
 *   category: string
 *   runtime: string
 *   status: LabStatusFilter
 *   progression: LabProgressionFilter
 *   source?: LabSourceFilter
 *   hideInvalid: boolean
 *   hideCommunityDefinitions?: boolean
 * }} filters
 */
export function filterLabs(labs, filters) {
  const q = filters.search.trim().toLowerCase()
  return labs.filter((lab) => {
    if (filters.hideInvalid && !lab.valid) return false
    if (
      filters.hideCommunityDefinitions &&
      filters.source !== 'community' &&
      lab.source === 'community' &&
      lab.valid &&
      !lab.runnable
    ) {
      return false
    }
    if (filters.source && filters.source !== 'all') {
      if (filters.source === 'bundled' && !(lab.bundled === true || lab.source === 'bundled')) {
        return false
      }
      if (filters.source === 'community' && lab.source !== 'community') return false
      if (filters.source === 'online' && lab.source !== 'online') return false
      if (
        filters.source === 'installed' &&
        lab.source !== 'online' &&
        lab.source !== 'community'
      ) {
        return false
      }
    }
    if (filters.progression && filters.progression !== 'all') {
      const bucket = labProgressionBucket(lab)
      if (filters.progression !== bucket) return false
    }
    if (filters.status !== 'all') {
      const bucket = labStatusBucket(lab)
      if (filters.status !== bucket) return false
    }
    if (filters.difficulty !== 'all' && lab.difficulty !== filters.difficulty) return false
    if (filters.category !== 'all' && lab.category !== filters.category) return false
    if (filters.runtime !== 'all' && lab.runtime !== filters.runtime) return false
    if (!q) return true
    const tagHay = Array.isArray(lab.tags) ? lab.tags.join(' ') : ''
    const hay = `${lab.title} ${lab.description} ${lab.id} ${lab.category} ${tagHay}`.toLowerCase()
    return hay.includes(q)
  })
}

/**
 * @param {object[]} labs
 */
export function uniqueCategories(labs) {
  return [...new Set(labs.map((l) => l.category).filter(Boolean))].sort()
}

/**
 * @param {object[]} labs
 */
export function uniqueRuntimes(labs) {
  return [...new Set(labs.map((l) => l.runtime).filter(Boolean))].sort()
}

/**
 * @param {object[]} labs
 * @param {string} sortBy
 */
export function sortLabs(labs, sortBy = 'default') {
  const copy = [...labs]
  const difficultyRank = { Easy: 1, Medium: 2, Hard: 3, Expert: 4 }

  switch (sortBy) {
    case 'title':
      return copy.sort((a, b) => String(a.title).localeCompare(String(b.title)))
    case 'xp-desc':
      return copy.sort((a, b) => (b.xpReward ?? 0) - (a.xpReward ?? 0))
    case 'xp-asc':
      return copy.sort((a, b) => (a.xpReward ?? 0) - (b.xpReward ?? 0))
    case 'difficulty':
      return copy.sort(
        (a, b) => (difficultyRank[a.difficulty] ?? 99) - (difficultyRank[b.difficulty] ?? 99)
      )
    case 'status':
      return copy.sort((a, b) => {
        const order = { ready: 0, scaffold: 1, invalid: 2 }
        return (order[labStatusBucket(a)] ?? 9) - (order[labStatusBucket(b)] ?? 9)
      })
    default:
    case 'progression':
      return sortLabsByUnlockOrder(copy)
  }
}

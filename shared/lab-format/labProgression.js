/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @type {Record<string, number>} */
export const TIER_LEVEL_OFFSET = {
  beginner: 0,
  intermediate: 1,
  advanced: 2
}

/** @type {Record<string, { baseLevel: number, trackGate: string[] }>} */
export const TRACK_PROGRESSION = {
  'linux-basics': { baseLevel: 1, trackGate: ['beginner-linux-001'] },
  'file-permissions': { baseLevel: 2, trackGate: ['permissions-001'] },
  networking: { baseLevel: 3, trackGate: ['permissions-001'] },
  docker: { baseLevel: 3, trackGate: ['docker-cli-001'] },
  'web-server': { baseLevel: 3, trackGate: ['nginx-001'] },
  databases: { baseLevel: 4, trackGate: ['shell-basics-001'] },
  'security-basics': { baseLevel: 4, trackGate: ['permissions-001'] },
  troubleshooting: { baseLevel: 5, trackGate: ['service-repair-001'] },
  'windows-concepts': { baseLevel: 4, trackGate: ['beginner-linux-001'] },
  'advanced-networking': { baseLevel: 5, trackGate: ['net-ss-005'] },
  'advanced-security': { baseLevel: 5, trackGate: ['sec-ssh-hardening-002'] },
  'advanced-docker': { baseLevel: 5, trackGate: ['docker-compose-up-012'] },
  'advanced-databases': { baseLevel: 5, trackGate: ['db-select-filter-003'] },
  'advanced-troubleshooting': { baseLevel: 6, trackGate: ['ts-service-down-002'] }
}

/** @type {Record<string, number>} */
export const DIFFICULTY_XP = {
  Easy: 50,
  Medium: 80,
  Hard: 110,
  Expert: 150
}

/**
 * @param {string} track
 * @param {keyof typeof TIER_LEVEL_OFFSET | string} tier
 * @param {number} labIndex
 * @param {{ slug: string }[]} sectionLabs
 * @param {boolean} [bundled=true]
 */
export function buildUnlockRequirements(track, tier, labIndex, sectionLabs, bundled = true) {
  const cfg = TRACK_PROGRESSION[track] ?? {
    baseLevel: bundled ? 2 : 5,
    trackGate: bundled ? ['beginner-linux-001'] : []
  }
  const tierKey = String(tier ?? 'beginner').toLowerCase()
  const offset = TIER_LEVEL_OFFSET[tierKey] ?? 0
  const minLevel = Math.min(7, cfg.baseLevel + offset)

  /** @type {string[]} */
  const requiredLabs = []
  if (labIndex > 0 && sectionLabs[labIndex - 1]?.slug) {
    requiredLabs.push(sectionLabs[labIndex - 1].slug)
  } else if (cfg.trackGate.length > 0) {
    requiredLabs.push(...cfg.trackGate)
  }

  /** @type {{ minLevel: number, requiredLabs?: string[] }} */
  const unlock = { minLevel }
  if (requiredLabs.length > 0) {
    unlock.requiredLabs = requiredLabs
  }
  return unlock
}

/**
 * @param {string} difficulty Easy | Medium | Hard | Expert
 */
export function xpForDifficulty(difficulty) {
  return DIFFICULTY_XP[difficulty] ?? 60
}

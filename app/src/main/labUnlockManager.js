/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { getDatabase } from './db/database.js'
import { getConfigPath } from './utils/paths.js'
import { discoverLabLocations, clearLabLocationCache } from './labCatalogDiscovery.js'
import {
  getLabMinUnlockLevel,
  getLabRequiredLabIds,
  sortLabsByUnlockOrder
} from '@sysadmin-game/shared/lab-format/labUnlockSort.js'
import { pushActivity, pushNotification } from './profileManager.js'

/** @type {Map<string, { id: string, title: string }> | null} */
let catalogCache = null

/** @type {Record<string, number> | null} */
let legacyLabUnlocks = null

function loadLegacyLabUnlocks() {
  if (legacyLabUnlocks) return legacyLabUnlocks
  try {
    const raw = JSON.parse(fs.readFileSync(getConfigPath('app.defaults.json'), 'utf8'))
    legacyLabUnlocks =
      raw?.labUnlocks && typeof raw.labUnlocks === 'object' ? { ...raw.labUnlocks } : {}
    delete legacyLabUnlocks._comment
  } catch {
    legacyLabUnlocks = {}
  }
  return legacyLabUnlocks
}

function getProfileLevel() {
  const row = getDatabase().prepare('SELECT level FROM user_profile WHERE id = 1').get()
  return row?.level ?? 1
}

function getCompletedLabIds() {
  return new Set(
    getDatabase()
      .prepare('SELECT lab_id FROM lab_progress WHERE completed = 1')
      .all()
      .map((row) => row.lab_id)
  )
}

function getUnlockedAchievementIds() {
  return new Set(
    getDatabase()
      .prepare('SELECT achievement_id FROM achievements')
      .all()
      .map((row) => row.achievement_id)
  )
}

/**
 * @returns {Map<string, { id: string, title: string }>}
 */
function getCatalogById() {
  if (!catalogCache) {
    /** @type {Map<string, { id: string, title: string }>} */
    const map = new Map()
    for (const loc of discoverLabLocations()) {
      const labPath = path.join(loc.labsRoot, loc.folder, 'lab.json')
      try {
        const data = JSON.parse(fs.readFileSync(labPath, 'utf8'))
        const id = data?.id ?? loc.folder
        map.set(id, { id, title: data?.title ?? id })
      } catch {
        map.set(loc.folder, { id: loc.folder, title: loc.folder })
      }
    }
    catalogCache = map
  }
  return catalogCache
}

export function clearLabUnlockCatalogCache() {
  catalogCache = null
  clearLabLocationCache()
}

/**
 * @param {string} labId
 * @param {Map<string, { id: string, title: string }>} catalogById
 */
function labTitleForId(labId, catalogById) {
  return catalogById.get(labId)?.title ?? labId
}

/**
 * @param {string} achievementId
 */
function achievementTitleForId(achievementId) {
  const titles = {
    first_lab: 'First Steps',
    no_hints: 'No Hints Needed',
    docker_ready: 'Container Captain',
    five_labs: 'Lab Explorer',
    validation_master: 'Validation Master',
    linux_basics_complete: 'Linux Basics Graduate',
    networking_intro: 'Networking Intro'
  }
  return titles[achievementId] ?? achievementId
}

/**
 * @param {object | null | undefined} lab
 */
function resolveMinUnlockLevel(lab) {
  const fromLab = getLabMinUnlockLevel(lab)
  if (fromLab > 1) return fromLab
  const legacy = loadLegacyLabUnlocks()
  const fallback = legacy?.[lab?.id]
  return typeof fallback === 'number' && fallback >= 1 ? fallback : fromLab
}

/**
 * @param {{ activeLabIds?: string[] }} [options]
 */
export function buildProgressContext(options = {}) {
  return {
    level: getProfileLevel(),
    completedLabIds: getCompletedLabIds(),
    unlockedAchievementIds: getUnlockedAchievementIds(),
    activeLabIds: new Set(options.activeLabIds ?? []),
    catalogById: getCatalogById()
  }
}

/**
 * @param {object} lab
 * @param {ReturnType<typeof buildProgressContext>} ctx
 */
export function evaluateLabUnlock(lab, ctx) {
  const minUnlockLevel = resolveMinUnlockLevel(lab)
  /** @type {{ type: 'lab' | 'achievement' | 'level', label: string }[]} */
  const missingRequirements = []

  if (ctx.level < minUnlockLevel) {
    missingRequirements.push({
      type: 'level',
      label: `Reach level ${minUnlockLevel}`
    })
  }

  for (const requiredLabId of getLabRequiredLabIds(lab)) {
    if (!ctx.completedLabIds.has(requiredLabId)) {
      missingRequirements.push({
        type: 'lab',
        label: labTitleForId(requiredLabId, ctx.catalogById)
      })
    }
  }

  const requiredAchievements = lab?.unlockRequirements?.requiredAchievements ?? []
  if (Array.isArray(requiredAchievements)) {
    for (const achievementId of requiredAchievements) {
      if (typeof achievementId !== 'string' || !achievementId) continue
      if (!ctx.unlockedAchievementIds.has(achievementId)) {
        missingRequirements.push({
          type: 'achievement',
          label: achievementTitleForId(achievementId)
        })
      }
    }
  }

  const unlocked = missingRequirements.length === 0
  const locked = !unlocked

  let progressState = 'available'
  if (ctx.completedLabIds.has(lab.id)) {
    progressState = 'completed'
  } else if (ctx.activeLabIds.has(lab.id)) {
    progressState = 'in_progress'
  }

  /** @type {string[]} */
  const summaryLines = []
  if (locked) {
    if (minUnlockLevel > 1) {
      summaryLines.push(`Unlocks at Level ${minUnlockLevel}`)
    }
    const missingLabs = missingRequirements.filter((m) => m.type === 'lab')
    if (missingLabs.length > 0) {
      summaryLines.push('Complete:')
      for (const item of missingLabs) {
        summaryLines.push(`- ${item.label}`)
      }
    }
    const missingAchievements = missingRequirements.filter((m) => m.type === 'achievement')
    if (missingAchievements.length > 0) {
      summaryLines.push('Achievements:')
      for (const item of missingAchievements) {
        summaryLines.push(`- ${item.label}`)
      }
    }
    if (summaryLines.length === 0) {
      summaryLines.push('Complete prerequisites to unlock')
    }
  }

  return {
    unlocked,
    locked,
    minUnlockLevel,
    missingRequirements,
    unlockSummary: summaryLines.length ? summaryLines.join('\n') : null,
    progressState
  }
}

/**
 * @param {object} lab
 * @param {ReturnType<typeof evaluateLabUnlock>} unlock
 */
export function enrichLabCatalogEntry(lab, unlock) {
  return {
    locked: unlock.locked,
    unlocked: unlock.unlocked,
    minUnlockLevel: unlock.minUnlockLevel,
    missingRequirements: unlock.missingRequirements,
    unlockSummary: unlock.unlockSummary,
    progressState: unlock.progressState,
    unlockRequirements: lab?.unlockRequirements ?? null
  }
}

/**
 * @param {string} labId
 * @param {{ activeLabIds?: string[] }} [options]
 */
export function assertLabUnlocked(labId, options = {}) {
  const loc = discoverLabLocations().find((entry) => entry.labId === labId || entry.folder === labId)
  if (!loc) {
    throw new Error(`Lab not found: ${labId}`)
  }
  const labPath = path.join(loc.labsRoot, loc.folder, 'lab.json')
  const lab = JSON.parse(fs.readFileSync(labPath, 'utf8'))
  const ctx = buildProgressContext(options)
  const unlock = evaluateLabUnlock(lab, ctx)
  if (!unlock.unlocked) {
    throw new Error(unlock.unlockSummary ?? 'This lab is locked.')
  }
}

/**
 * Load all lab definitions for unlock evaluation.
 */
function loadCatalogLabs() {
  return discoverLabLocations()
    .map((loc) => {
      const labPath = path.join(loc.labsRoot, loc.folder, 'lab.json')
      try {
        return JSON.parse(fs.readFileSync(labPath, 'utf8'))
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/**
 * @returns {string[]}
 */
export function getUnlockedLabIds() {
  const ctx = buildProgressContext()
  return loadCatalogLabs()
    .filter((lab) => evaluateLabUnlock(lab, ctx).unlocked)
    .map((lab) => lab.id)
}

/**
 * @param {string[]} before
 * @param {string[]} after
 */
export function diffNewlyUnlockedLabs(before, after) {
  const beforeSet = new Set(before)
  const catalogById = getCatalogById()
  return after
    .filter((id) => !beforeSet.has(id))
    .map((id) => ({
      id,
      title: labTitleForId(id, catalogById)
    }))
}

/**
 * @param {{ id: string, title: string }[]} newlyUnlockedLabs
 * @param {{ levelIncreased?: boolean, newLevel?: number }} meta
 */
export function notifyLabUnlocks(newlyUnlockedLabs, meta = {}) {
  for (const lab of newlyUnlockedLabs) {
    pushNotification({
      title: 'Lab unlocked',
      body: lab.title,
      tone: 'success'
    })
    pushActivity({
      type: 'lab',
      message: `Unlocked: ${lab.title}`,
      tone: 'success'
    })
  }

  if (meta.levelIncreased && meta.newLevel) {
    pushNotification({
      title: 'Level up!',
      body: `You reached level ${meta.newLevel}. New labs may be available.`,
      tone: 'success'
    })
  }
}

/**
 * @param {{ activeLabIds?: string[] }} [options]
 */
export function getProgressionOverview(options = {}) {
  const ctx = buildProgressContext(options)
  const labs = sortLabsByUnlockOrder(
    loadCatalogLabs().map((lab) => ({
      id: lab.id,
      title: lab.title,
      xpReward: lab.xpReward ?? 0,
      unlockRequirements: lab.unlockRequirements,
      minUnlockLevel: resolveMinUnlockLevel(lab),
      ...evaluateLabUnlock(lab, ctx)
    }))
  )

  const counts = { available: 0, locked: 0, inProgress: 0, completed: 0 }
  for (const lab of labs) {
    if (lab.progressState === 'completed') counts.completed += 1
    else if (lab.progressState === 'in_progress') counts.inProgress += 1
    else if (lab.locked) counts.locked += 1
    else counts.available += 1
  }

  const recommendedNext = labs
    .filter((lab) => lab.unlocked && lab.progressState !== 'completed')
    .slice(0, 3)
    .map((lab) => ({ id: lab.id, title: lab.title, xpReward: lab.xpReward }))

  const nextUnlockPreview = labs
    .filter((lab) => lab.locked)
    .slice(0, 3)
    .map((lab) => ({
      id: lab.id,
      title: lab.title,
      minUnlockLevel: lab.minUnlockLevel > 1 ? lab.minUnlockLevel : undefined
    }))

  return { counts, recommendedNext, nextUnlockPreview }
}

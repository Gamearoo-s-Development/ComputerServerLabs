/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * @param {object | null | undefined} lab
 * @returns {string[]}
 */
export function getLabRequiredLabIds(lab) {
  const req = lab?.unlockRequirements
  if (Array.isArray(req?.requiredLabs)) {
    return req.requiredLabs.filter((id) => typeof id === 'string' && id.length > 0)
  }
  return []
}

/**
 * @param {object | null | undefined} lab
 */
export function getLabMinUnlockLevel(lab) {
  if (typeof lab?.minUnlockLevel === 'number' && lab.minUnlockLevel >= 1) {
    return lab.minUnlockLevel
  }
  if (typeof lab?.unlockRequirements?.minLevel === 'number' && lab.unlockRequirements.minLevel >= 1) {
    return lab.unlockRequirements.minLevel
  }
  return 1
}

/**
 * Longest prerequisite chain length (lab dependencies only).
 * @param {string} labId
 * @param {Map<string, object>} byId
 * @param {Set<string>} [visiting]
 */
export function getLabPrerequisiteDepth(labId, byId, visiting = new Set()) {
  const lab = byId.get(labId)
  if (!lab) return 0

  const required = getLabRequiredLabIds(lab)
  if (required.length === 0) return 0
  if (visiting.has(labId)) return 0

  visiting.add(labId)
  let depth = 0
  for (const depId of required) {
    depth = Math.max(depth, getLabPrerequisiteDepth(depId, byId, visiting) + 1)
  }
  visiting.delete(labId)
  return depth
}

/**
 * Sort labs for the catalog: level gate → prerequisite depth → dependency count → id.
 * @param {object} a
 * @param {object} b
 * @param {object[]} allLabs
 */
export function compareLabsByUnlockOrder(a, b, allLabs) {
  const byId = new Map(allLabs.map((lab) => [lab.id, lab]))

  const levelA = getLabMinUnlockLevel(a)
  const levelB = getLabMinUnlockLevel(b)
  if (levelA !== levelB) return levelA - levelB

  const depthA = getLabPrerequisiteDepth(a.id, byId)
  const depthB = getLabPrerequisiteDepth(b.id, byId)
  if (depthA !== depthB) return depthA - depthB

  const reqA = getLabRequiredLabIds(a).length
  const reqB = getLabRequiredLabIds(b).length
  if (reqA !== reqB) return reqA - reqB

  return String(a.id).localeCompare(String(b.id))
}

/**
 * @param {object[]} labs
 */
export function sortLabsByUnlockOrder(labs) {
  const copy = [...labs]
  copy.sort((a, b) => compareLabsByUnlockOrder(a, b, copy))
  return copy
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Objective ids in learner-facing order (public first, then internal-only).
 * @param {object | null | undefined} lab
 * @returns {string[]}
 */
export function getObjectiveIdsInOrder(lab) {
  const publicList = Array.isArray(lab?.objectivesPublic) ? lab.objectivesPublic : []
  if (publicList.length > 0) {
    const ids = publicList.map((o) => o?.id).filter((id) => typeof id === 'string' && id)
    const internal = Array.isArray(lab?.objectives) ? lab.objectives : []
    for (const o of internal) {
      if (o?.id && !ids.includes(o.id)) ids.push(o.id)
    }
    return ids
  }
  return (lab?.objectives ?? []).map((o) => o?.id).filter((id) => typeof id === 'string' && id)
}

/**
 * @param {object | null | undefined} lab
 * @param {string} objectiveId
 */
function findPublicObjective(lab, objectiveId) {
  return (lab?.objectivesPublic ?? []).find((o) => o?.id === objectiveId) ?? null
}

/**
 * @param {object | null | undefined} lab
 * @param {string} objectiveId
 */
function findInternalObjective(lab, objectiveId) {
  return (lab?.objectives ?? []).find((o) => o?.id === objectiveId) ?? null
}

/**
 * @param {object | null | undefined} lab
 * @param {string} objectiveId
 * @returns {string | null}
 */
function explicitObjectiveHint(lab, objectiveId) {
  const pub = findPublicObjective(lab, objectiveId)
  if (typeof pub?.hint === 'string' && pub.hint.trim()) return pub.hint.trim()

  const internal = findInternalObjective(lab, objectiveId)
  if (typeof internal?.hint === 'string' && internal.hint.trim()) return internal.hint.trim()

  return null
}

/**
 * Hint for one objective: objectivesPublic.hint → objectives.hint → next legacy lab.hints entry.
 * Legacy hints only consume slots for objectives without an explicit hint.
 * @param {object | null | undefined} lab
 * @param {string} objectiveId
 * @returns {string | null}
 */
export function resolveObjectiveHint(lab, objectiveId) {
  return buildObjectiveHintMap(lab)[objectiveId] ?? null
}

/**
 * @param {object | null | undefined} lab
 * @returns {Record<string, string>}
 */
export function buildObjectiveHintMap(lab) {
  /** @type {Record<string, string>} */
  const map = {}
  const ids = getObjectiveIdsInOrder(lab)
  const legacy = Array.isArray(lab?.hints) ? lab.hints : []
  let legacyIndex = 0

  for (const id of ids) {
    const explicit = explicitObjectiveHint(lab, id)
    if (explicit) {
      map[id] = explicit
      continue
    }

    const legacyHint = legacy[legacyIndex]
    legacyIndex += 1
    if (typeof legacyHint === 'string' && legacyHint.trim()) {
      map[id] = legacyHint.trim()
    }
  }

  return map
}

/**
 * @param {object | null | undefined} lab
 */
export function countObjectiveHintsAvailable(lab) {
  return Object.keys(buildObjectiveHintMap(lab)).length
}

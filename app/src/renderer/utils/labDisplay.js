/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { resolveObjectiveHint } from '@sysadmin-game/shared/lab-format/labObjectiveHints.js'
import { devLog } from './devLog.js'

/**
 * @param {object | null | undefined} source
 * @returns {string | null}
 */
export function formatObjectiveDisplayText(source) {
  if (!source || typeof source !== 'object') return null
  const candidates = [source.title, source.text, source.label, source.prompt]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/**
 * @param {object | null | undefined} lab
 */
/**
 * @param {object | null | undefined} lab
 */
export function getObjectiveDisplayMode(lab) {
  const mode = lab?.objectiveDisplay ?? lab?.incident?.objectiveDisplay ?? 'visible'
  if (['visible', 'hidden', 'ticket-only', 'partial'].includes(mode)) return mode
  return 'visible'
}

/**
 * @param {object | null | undefined} lab
 */
export function shouldShowObjectivesInSession(lab, options = {}) {
  const mode = getObjectiveDisplayMode(lab)
  if (mode === 'ticket-only') return false
  if (mode === 'hidden' && !options.revealHidden) return false
  return true
}

/**
 * @param {object | null | undefined} lab
 */
export function getPublicObjectives(lab) {
  const mode = getObjectiveDisplayMode(lab)
  if (mode === 'ticket-only' || mode === 'hidden') {
    return []
  }

  if (Array.isArray(lab?.objectivesPublic) && lab.objectivesPublic.length > 0) {
    return lab.objectivesPublic.map((o) => ({
      id: o.id,
      label: o.text ?? o.label ?? o.id,
      ...(o.prompt ? { prompt: o.prompt } : {}),
      ...(o.text ? { text: o.text } : {}),
      ...(o.serviceRef ? { serviceRef: o.serviceRef } : {})
    }))
  }
  const internal = Array.isArray(lab?.objectives) ? lab.objectives : []
  return internal.map((o) => ({
    id: o.id,
    label: o.label,
    ...(o.prompt ? { prompt: o.prompt } : {}),
    ...(o.title ? { title: o.title } : {}),
    ...(o.text ? { text: o.text } : {}),
    ...(o.serviceRef ? { serviceRef: o.serviceRef } : {})
  }))
}

/**
 * @param {object} lab
 * @param {string} objectiveId
 */
export function getLinkedQuestions(lab, objectiveId) {
  return (lab?.questions ?? []).filter((q) => q.objectiveId === objectiveId)
}

/**
 * @param {object} lab
 * @param {string} objectiveId
 * @param {object | null} publicDef
 * @param {object | null} internalDef
 */
export function getObjectiveQuestions(lab, objectiveId, publicDef, internalDef) {
  const linked = getLinkedQuestions(lab, objectiveId)
  if (linked.length > 0) return linked

  const prompt = publicDef?.prompt ?? internalDef?.prompt
  if (typeof prompt === 'string' && prompt.trim()) {
    return [
      {
        id: `${objectiveId}-prompt`,
        objectiveId,
        prompt: prompt.trim(),
        questionType: 'textAnswer',
        answerKey: internalDef?.answerKey
      }
    ]
  }

  return []
}

/**
 * @param {object} lab
 * @param {object[]} stateRows
 */
export function mergeObjectiveRowsForDisplay(lab, stateRows) {
  const publicDefs = getPublicObjectives(lab)
  const internalDefs = Array.isArray(lab?.objectives) ? lab.objectives : []
  const publicById = new Map(publicDefs.map((o) => [o.id, o]))
  const internalById = new Map(internalDefs.map((o) => [o.id, o]))

  return stateRows.map((row) => {
    const pub = publicById.get(row.id) ?? null
    const internal = internalById.get(row.id) ?? null
    const displayText =
      formatObjectiveDisplayText(pub) ??
      formatObjectiveDisplayText(internal) ??
      formatObjectiveDisplayText(row) ??
      null

    if (!displayText) {
      devLog('labObjectives', 'Objective missing display text', { labId: lab?.id, objectiveId: row.id })
    }

    const questions = getObjectiveQuestions(lab, row.id, pub, internal)
    const hint = resolveObjectiveHint(lab, row.id)

    return {
      ...row,
      label: displayText ?? 'Unnamed objective',
      displayText: displayText ?? 'Unnamed objective',
      prompt: pub?.prompt ?? internal?.prompt ?? null,
      serviceRef: pub?.serviceRef ?? row.serviceRef ?? null,
      hint,
      questions,
      requiresAnswer: questions.length > 0,
      internal
    }
  })
}

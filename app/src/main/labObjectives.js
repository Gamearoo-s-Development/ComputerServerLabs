/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { resolveObjectiveHint } from '@sysadmin-game/shared/lab-format/labObjectiveHints.js'
import { logger } from './utils/logger.js'

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
export function getInternalObjectives(lab) {
  return Array.isArray(lab?.objectives) ? lab.objectives : []
}

/**
 * @param {object | null | undefined} lab
 */
export function getPublicObjectives(lab) {
  if (Array.isArray(lab?.objectivesPublic) && lab.objectivesPublic.length > 0) {
    return lab.objectivesPublic.map((o) => ({
      id: o.id,
      label: o.text ?? o.label ?? o.id,
      ...(o.prompt ? { prompt: o.prompt } : {}),
      ...(o.text ? { text: o.text } : {}),
      ...(o.serviceRef ? { serviceRef: o.serviceRef } : {}),
      ...(o.hint ? { hint: o.hint } : {})
    }))
  }
  return getInternalObjectives(lab).map((o) => ({
    id: o.id,
    label: o.label,
    ...(o.prompt ? { prompt: o.prompt } : {}),
    ...(o.title ? { title: o.title } : {}),
    ...(o.text ? { text: o.text } : {}),
    ...(o.serviceRef ? { serviceRef: o.serviceRef } : {}),
    ...(o.hint ? { hint: o.hint } : {})
  }))
}

/**
 * Questions linked to an objective (lab.questions with objectiveId).
 * @param {object} lab
 * @param {string} objectiveId
 */
export function getLinkedQuestions(lab, objectiveId) {
  return (lab?.questions ?? []).filter((q) => q.objectiveId === objectiveId)
}

/**
 * Build Q&A entries for an objective: explicit questions + public prompt as text question.
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
        answerKey: internalDef?.answerKey,
        answerConfig: internalDef?.answerConfig ?? publicDef?.answerConfig,
        acceptedAnswers: internalDef?.acceptedAnswers
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
  const internalDefs = getInternalObjectives(lab)
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
      logger.warn('labObjectives', 'Objective missing display text', {
        labId: lab?.id,
        objectiveId: row.id
      })
    }

    const questions = getObjectiveQuestions(lab, row.id, pub, internal)
    const hint = resolveObjectiveHint(lab, row.id)

    return {
      ...row,
      label: displayText ?? 'Unnamed objective',
      displayText: displayText ?? 'Unnamed objective',
      prompt: pub?.prompt ?? internal?.prompt ?? null,
      hint,
      questions,
      requiresAnswer: questions.length > 0,
      internal
    }
  })
}

/**
 * @param {object} validation
 * @param {object} outcome
 * @param {boolean} debug
 */
export function formatLearnerValidationMessage(validation, outcome, debug) {
  if (debug) return outcome.message
  switch (validation?.type) {
    case 'fileExists':
      return outcome.passed
        ? 'Lab completion requirements are satisfied.'
        : 'Lab completion requirements are not met yet. Finish the required steps in the lab environment.'
    case 'command':
      return outcome.passed ? 'Required command succeeded.' : 'Required command did not succeed yet.'
    case 'portOpen':
      return outcome.passed ? 'Required service port is reachable.' : 'Required service port is not reachable yet.'
    case 'serviceRunning':
      return outcome.passed ? 'Required service is running.' : 'Required service is not running yet.'
    case 'httpResponse':
      return outcome.passed ? 'HTTP check passed.' : 'HTTP check did not pass yet.'
    default:
      return outcome.passed ? 'Lab check passed.' : 'Lab check did not pass yet.'
  }
}

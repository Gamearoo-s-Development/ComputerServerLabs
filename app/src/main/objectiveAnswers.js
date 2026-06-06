/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { matchTextAnswer } from './utils/sanitize.js'

/**
 * @param {string} answer
 * @param {string[]} acceptedAnswers
 * @param {{ caseSensitive?: boolean, useRegex?: boolean }} [config]
 */
export function evaluateObjectiveAnswer(answer, acceptedAnswers, config = {}) {
  const trimmed = String(answer ?? '').trim()
  if (!trimmed) {
    return { correct: false, reason: 'empty' }
  }

  const accepted = (acceptedAnswers ?? []).filter((a) => typeof a === 'string' && a.length > 0)
  if (!accepted.length) {
    return { correct: false, reason: 'no_accepted_answers' }
  }

  if (config.allowContains === true) {
    const hay = config.caseSensitive ? trimmed : trimmed.toLowerCase()
    for (const pattern of accepted) {
      const needle = config.caseSensitive ? pattern.trim() : pattern.trim().toLowerCase()
      if (needle && hay.includes(needle)) return { correct: true, reason: null }
    }
    return { correct: false, reason: 'incorrect' }
  }

  if (config.useRegex === true) {
    for (const pattern of accepted) {
      try {
        const flags = config.caseSensitive ? '' : 'i'
        const re = new RegExp(pattern, flags)
        if (re.test(trimmed)) return { correct: true, reason: null }
      } catch {
        /* invalid regex pattern — skip */
      }
    }
    return { correct: false, reason: 'incorrect' }
  }

  if (config.caseSensitive === true) {
    const ok = accepted.some((item) => item.trim() === trimmed)
    return { correct: ok, reason: ok ? null : 'incorrect' }
  }

  const ok = matchTextAnswer(trimmed, accepted)
  return { correct: ok, reason: ok ? null : 'incorrect' }
}

/**
 * @param {object} objective
 * @param {object} question
 */
export function resolveAcceptedAnswers(objective, question) {
  if (Array.isArray(question?.acceptedAnswers) && question.acceptedAnswers.length) {
    return question.acceptedAnswers
  }
  if (Array.isArray(objective?.acceptedAnswers) && objective.acceptedAnswers.length) {
    return objective.acceptedAnswers
  }
  return []
}

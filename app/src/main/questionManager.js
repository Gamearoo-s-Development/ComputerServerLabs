/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getDatabase } from './db/database.js'
import { listLabs, getLab } from './labManager.js'
import { matchTextAnswer, normalizeTextAnswer } from './utils/sanitize.js'

function nowIso() {
  return new Date().toISOString()
}

export function listQuestions() {
  const { labs } = listLabs()
  const questions = []

  for (const summary of labs) {
    if (!summary.valid) continue
    try {
      const lab = getLab(summary.id)
      for (const q of lab.questions ?? []) {
        questions.push({
          ...q,
          labId: lab.id,
          labTitle: lab.title
        })
      }
    } catch {
      // skip invalid labs
    }
  }

  return questions
}

/**
 * @param {string} questionId
 * @param {string} answer
 */
export function submitQuestionAnswer(questionId, answer) {
  const questions = listQuestions()
  const question = questions.find((q) => q.id === questionId)
  if (!question) {
    throw new Error(`Question not found: ${questionId}`)
  }

  const correct = matchTextAnswer(answer, question.acceptedAnswers)
  getDatabase()
    .prepare('INSERT INTO question_attempts (question_id, correct, answered_at) VALUES (?, ?, ?)')
    .run(questionId, correct ? 1 : 0, nowIso())

  return {
    correct,
    normalizedAnswer: normalizeTextAnswer(answer),
    questionId
  }
}

export function getQuestionAttempts(questionId) {
  return getDatabase()
    .prepare('SELECT * FROM question_attempts WHERE question_id = ? ORDER BY answered_at DESC')
    .all(questionId)
}

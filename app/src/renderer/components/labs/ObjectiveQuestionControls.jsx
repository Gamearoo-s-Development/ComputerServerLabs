/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState } from 'react'
import { Button } from '../ui/index.js'
import { cn } from '../../utils/cn.js'

/**
 * @param {{
 *   sessionId: string
 *   objectiveId: string
 *   questions: object[]
 *   objectiveStatus: string
 *   objectiveCompleted: boolean
 *   onSubmit: (questionId: string, answer: string) => Promise<{ ok: boolean, data?: object, error?: object }>
 *   onUpdated: (objectives: object[], meta?: { triggerValidation?: boolean }) => void
 *   notify: (payload: object) => void
 * }} props
 */
export default function ObjectiveQuestionControls({
  sessionId,
  objectiveId,
  questions,
  objectiveStatus,
  objectiveCompleted,
  onSubmit,
  onUpdated,
  notify
}) {
  const [answers, setAnswers] = useState(() => ({}))
  const [feedback, setFeedback] = useState(() => ({}))
  const [submitting, setSubmitting] = useState(null)

  if (!questions?.length) return null

  return (
    <div className="space-y-3 pl-6">
      {questions.map((question) => {
        const qid = question.id ?? `${objectiveId}-prompt`
        const answerValue = answers[qid] ?? ''
        const qFeedback = feedback[qid]
        const qType = question.questionType ?? 'textAnswer'
        const disabled = objectiveCompleted || submitting === qid

        const placeholder =
          qType === 'commandAnswer'
            ? 'Enter the command you used…'
            : qType === 'filePathAnswer'
              ? 'Enter the file path…'
              : qType === 'matchOutput'
                ? 'Paste the expected output…'
                : qType === 'troubleshootingScenario'
                  ? 'Describe your diagnosis or fix…'
                  : 'Your answer…'

        return (
          <div
            key={qid}
            className={cn(
              'rounded-md border border-border/70 bg-background/30 p-2.5',
              objectiveCompleted && 'border-success/25 bg-success/5'
            )}
          >
            <p className="text-xs font-medium text-gray-200">{question.prompt}</p>

            {qType === 'multipleChoice' && Array.isArray(question.options) && question.options.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {question.options.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                    <input
                      type="radio"
                      name={`${sessionId}-${qid}`}
                      checked={answerValue === opt}
                      disabled={disabled}
                      onChange={() => setAnswers((prev) => ({ ...prev, [qid]: opt }))}
                      className="border-border text-accent focus:ring-accent/40"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : qType === 'troubleshootingScenario' ? (
              <textarea
                value={answerValue}
                disabled={disabled}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [qid]: e.target.value }))}
                placeholder={placeholder}
                rows={3}
                className="mt-2 w-full rounded-md border border-border bg-background-elevated px-2 py-1.5 text-xs text-white focus:border-accent focus:outline-none"
              />
            ) : (
              <input
                type="text"
                value={answerValue}
                disabled={disabled}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [qid]: e.target.value }))}
                placeholder={placeholder}
                className="mt-2 w-full rounded-md border border-border bg-background-elevated px-2 py-1.5 text-xs text-white focus:border-accent focus:outline-none"
              />
            )}

            {qFeedback ? (
              <p
                className={cn(
                  'mt-2 text-[11px]',
                  qFeedback.tone === 'success' ? 'text-success' : 'text-warning'
                )}
              >
                {qFeedback.message}
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={disabled || !String(answerValue).trim()}
                onClick={async () => {
                  setSubmitting(qid)
                  try {
                    const res = await onSubmit(qid, String(answerValue))
                    if (!res?.ok) {
                      setFeedback((prev) => ({
                        ...prev,
                        [qid]: {
                          tone: 'warning',
                          message: res.error?.message ?? 'Could not submit answer.'
                        }
                      }))
                      notify({
                        title: 'Answer failed',
                        body: res.error?.message ?? '',
                        tone: 'danger'
                      })
                      return
                    }
                    const data = res.data
                    onUpdated(data.objectives ?? [], {
                      triggerValidation: data.correct === true && data.allObjectivesComplete === true
                    })
                    setFeedback((prev) => ({
                      ...prev,
                      [qid]: {
                        tone: data.correct ? 'success' : 'warning',
                        message: data.message ?? (data.correct ? 'Correct.' : 'Not quite — try again.')
                      }
                    }))
                    notify({
                      title: data.correct ? 'Answer accepted' : 'Not quite',
                      body: data.message ?? (data.correct ? 'Objective updated.' : 'Try again.'),
                      tone: data.correct ? 'success' : 'warning'
                    })
                  } finally {
                    setSubmitting(null)
                  }
                }}
              >
                {submitting === qid ? 'Checking…' : 'Submit'}
              </Button>
              <span className="text-[10px] uppercase tracking-wide text-muted-dim">
                {objectiveCompleted ? 'complete' : objectiveStatus}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

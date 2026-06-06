/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState } from 'react'
import { Button } from '../ui/index.js'

/**
 * @param {{ formLab: object, patchLabField: (path: string, value: unknown) => void }} props
 */
export default function LabBuilderQuestionsStep({ formLab, patchLabField }) {
  const [idx, setIdx] = useState(0)
  const questions = formLab.questions ?? []
  const current = questions[idx] ?? {
    id: 'q1',
    prompt: '',
    acceptedAnswers: [],
    caseSensitive: false
  }

  function patchQuestion(partial) {
    const next = [...questions]
    next[idx] = { ...current, ...partial }
    patchLabField('questions', next)
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const next = [
              ...questions,
              { id: `q${questions.length + 1}`, prompt: '', acceptedAnswers: [], caseSensitive: false }
            ]
            patchLabField('questions', next)
            setIdx(next.length - 1)
          }}
        >
          Add question
        </Button>
        {questions.length > 1 ? (
          <select
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-white"
          >
            {questions.map((q, i) => (
              <option key={q.id ?? i} value={i}>
                {q.id ?? `Question ${i + 1}`}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {questions.length ? (
        <dl className="grid gap-3 md:grid-cols-2">
          <label>
            <span className="text-xs text-muted">Question id</span>
            <input
              value={current.id ?? ''}
              onChange={(e) => patchQuestion({ id: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
            />
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={current.caseSensitive === true}
              onChange={(e) => patchQuestion({ caseSensitive: e.target.checked })}
            />
            <span className="text-xs text-muted">Case sensitive</span>
          </label>
          <label className="md:col-span-2">
            <span className="text-xs text-muted">Prompt</span>
            <textarea
              value={current.prompt ?? ''}
              onChange={(e) => patchQuestion({ prompt: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
            />
          </label>
          <label className="md:col-span-2">
            <span className="text-xs text-muted">Accepted answers (one per line)</span>
            <textarea
              value={(current.acceptedAnswers ?? []).join('\n')}
              onChange={(e) =>
                patchQuestion({
                  acceptedAnswers: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean)
                })
              }
              rows={4}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
            />
          </label>
        </dl>
      ) : (
        <p className="text-xs text-muted">Optional — add quiz questions for knowledge checks.</p>
      )}
    </div>
  )
}

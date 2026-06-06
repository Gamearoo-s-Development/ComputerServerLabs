/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState } from 'react'
import { Button, Card } from '../ui/index.js'

const AUTO_CHECKS = [
  { id: '', label: 'Manual / checkbox only' },
  { id: 'fileExists', label: 'File exists' },
  { id: 'command', label: 'Command exits 0' },
  { id: 'portOpen', label: 'Port listening' },
  { id: 'httpResponse', label: 'HTTP response' },
  { id: 'serviceRunning', label: 'Service running' },
  { id: 'textAnswer', label: 'Text answer' }
]

const DEFAULT_OBJ = {
  id: 'objective-1',
  label: 'Complete the lab',
  description: '',
  required: true,
  hidden: false,
  autoCheck: 'fileExists',
  path: '/tmp/lab-complete'
}

/**
 * @param {{ formLab: object, patchLabField: (path: string, value: unknown) => void }} props
 */
export default function LabBuilderObjectivesStep({ formLab, patchLabField }) {
  const [idx, setIdx] = useState(0)
  const objectives = formLab.objectives ?? []
  const objectivesPublic = formLab.objectivesPublic ?? []
  const current = objectives[idx] ?? { ...DEFAULT_OBJ }

  function updateObjectives(next) {
    patchLabField('objectives', next)
  }

  function patchObjective(partial) {
    const next = [...objectives]
    next[idx] = { ...current, ...partial }
    updateObjectives(next)
  }

  function addObjective() {
    const id = `objective-${objectives.length + 1}`
    const next = [...objectives, { ...DEFAULT_OBJ, id, label: `Objective ${objectives.length + 1}` }]
    setIdx(next.length - 1)
    updateObjectives(next)
  }

  function removeObjective() {
    const next = objectives.filter((_, i) => i !== idx)
    setIdx(Math.max(0, idx - 1))
    updateObjectives(next)
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <p className="text-xs text-muted">
          Internal objectives drive auto-validation. Use <strong className="text-white">objectivesPublic</strong> for
          learner-facing text without spoilers.
        </p>
        <label className="mt-3 block text-sm">
          <span className="text-xs text-muted">Objective display mode</span>
          <select
            value={formLab.objectiveDisplay ?? 'visible'}
            onChange={(e) => patchLabField('objectiveDisplay', e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
          >
            <option value="visible">Visible</option>
            <option value="hidden">Hidden until complete</option>
            <option value="ticket-only">Ticket only</option>
            <option value="partial">Partial reveal</option>
          </select>
        </label>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={addObjective}>
          Add objective
        </Button>
        {objectives.length > 1 ? (
          <select
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-white"
          >
            {objectives.map((o, i) => (
              <option key={o.id ?? i} value={i}>
                {o.label || o.id || `Objective ${i + 1}`}
              </option>
            ))}
          </select>
        ) : null}
        {objectives.length ? (
          <Button variant="ghost" size="sm" onClick={removeObjective}>
            Remove
          </Button>
        ) : null}
      </div>

      {objectives.length ? (
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <label>
            <span className="text-xs text-muted">Id</span>
            <input
              value={current.id ?? ''}
              onChange={(e) => patchObjective({ id: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
            />
          </label>
          <label>
            <span className="text-xs text-muted">Auto-check type</span>
            <select
              value={current.autoCheck ?? ''}
              onChange={(e) => patchObjective({ autoCheck: e.target.value || undefined })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
            >
              {AUTO_CHECKS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="text-xs text-muted">Title / label</span>
            <input
              value={current.label ?? ''}
              onChange={(e) => patchObjective({ label: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
            />
          </label>
          <label className="md:col-span-2">
            <span className="text-xs text-muted">Description</span>
            <textarea
              value={current.description ?? ''}
              onChange={(e) => patchObjective({ description: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
            />
          </label>
          {(current.autoCheck === 'fileExists' || !current.autoCheck) && (
            <label className="md:col-span-2">
              <span className="text-xs text-muted">Path (for file checks)</span>
              <input
                value={current.path ?? ''}
                onChange={(e) => patchObjective({ path: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
              />
            </label>
          )}
          {current.autoCheck === 'command' && (
            <label className="md:col-span-2">
              <span className="text-xs text-muted">Command</span>
              <input
                value={current.command ?? ''}
                onChange={(e) => patchObjective({ command: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
              />
            </label>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={current.required !== false}
              onChange={(e) => patchObjective({ required: e.target.checked })}
            />
            <span className="text-xs text-muted">Required</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={current.hidden === true}
              onChange={(e) => patchObjective({ hidden: e.target.checked })}
            />
            <span className="text-xs text-muted">Hidden until prior objectives done</span>
          </label>
        </dl>
      ) : (
        <p className="text-xs text-muted-dim">No objectives yet — add at least one for validation.</p>
      )}

      <Card className="!p-4">
        <p className="text-xs font-semibold uppercase text-muted-dim">Public objectives (learner-facing)</p>
        <textarea
          rows={6}
          value={JSON.stringify(objectivesPublic, null, 2)}
          onChange={(e) => {
            try {
              patchLabField('objectivesPublic', JSON.parse(e.target.value))
            } catch {
              // ignore while typing
            }
          }}
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-border bg-background-elevated p-3 font-mono text-xs text-gray-100"
        />
      </Card>
    </div>
  )
}

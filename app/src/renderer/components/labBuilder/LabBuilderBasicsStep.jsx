/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { GAME_UI } from '../../constants/gameTone.js'

/**
 * @param {{ formLab: object, patchLabField: (path: string, value: unknown) => void, patchUnlockRequirements: (p: object) => void }} props
 */
export default function LabBuilderBasicsStep({ formLab, patchLabField, patchUnlockRequirements }) {
  return (
    <dl className="grid gap-3 text-sm md:grid-cols-2">
      <label className="md:col-span-2">
        <span className="text-xs text-muted">Title</span>
        <input
          value={formLab.title ?? ''}
          onChange={(e) => patchLabField('title', e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
        />
      </label>
      <label>
        <span className="text-xs text-muted">Lab id</span>
        <input
          value={formLab.id ?? ''}
          onChange={(e) => patchLabField('id', e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
        />
      </label>
      <label>
        <span className="text-xs text-muted">Difficulty</span>
        <select
          value={formLab.difficulty ?? 'Easy'}
          onChange={(e) => patchLabField('difficulty', e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
        >
          {['Easy', 'Medium', 'Hard', 'Expert'].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="text-xs text-muted">Category</span>
        <input
          value={formLab.category ?? ''}
          onChange={(e) => patchLabField('category', e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
        />
      </label>
      <label>
        <span className="text-xs text-muted">Est. minutes</span>
        <input
          type="number"
          value={formLab.estimatedTimeMinutes ?? ''}
          onChange={(e) => patchLabField('estimatedTimeMinutes', Number(e.target.value) || 0)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
        />
      </label>
      <label>
        <span className="text-xs text-muted">XP reward</span>
        <input
          type="number"
          value={formLab.xpReward ?? 0}
          onChange={(e) => patchLabField('xpReward', Number(e.target.value) || 0)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
        />
      </label>
      <label className="md:col-span-2">
        <span className="text-xs text-muted">Description</span>
        <textarea
          value={formLab.description ?? ''}
          onChange={(e) => patchLabField('description', e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
        />
      </label>

      <div className="md:col-span-2 space-y-3 rounded-lg border border-border bg-background-elevated/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Security simulation / CTF</p>
        <label className="flex items-start gap-2 text-sm text-gray-200">
          <input
            type="checkbox"
            checked={formLab.securitySimulation === true}
            onChange={(e) => {
              const enabled = e.target.checked
              patchLabField('securitySimulation', enabled)
              if (enabled) {
                if (!formLab.category) patchLabField('category', 'Security Simulation')
                if (!formLab.accessMode) patchLabField('accessMode', 'discover')
                if (formLab.hideDirectSshCommand !== true) patchLabField('hideDirectSshCommand', true)
              }
            }}
            className="mt-1"
          />
          <span>This is a security simulation / CTF lab (isolated practice only)</span>
        </label>
        {formLab.securitySimulation ? (
          <>
            <label>
              <span className="text-xs text-muted">Subcategory</span>
              <select
                value={formLab.securitySubcategory ?? ''}
                onChange={(e) => patchLabField('securitySubcategory', e.target.value || null)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              >
                <option value="">—</option>
                {[
                  'Enumeration',
                  'Web Exploitation',
                  'Privilege Escalation',
                  'Password Recovery',
                  'Misconfiguration',
                  'CTF Challenge'
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs text-muted">Credential access mode</span>
              <select
                value={formLab.accessMode ?? 'discover'}
                onChange={(e) => patchLabField('accessMode', e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              >
                <option value="discover">Discover — hide credentials</option>
                <option value="provided">Provided — show credentials</option>
              </select>
            </label>
            <p className="text-xs text-warning">{GAME_UI.securitySimulationWarning}</p>
          </>
        ) : null}
      </div>

      <label className="md:col-span-2">
        <span className="text-xs text-muted">Tasks (one per line — learner checklist)</span>
        <textarea
          value={(formLab.tasks ?? []).join('\n')}
          onChange={(e) =>
            patchLabField(
              'tasks',
              e.target.value
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          rows={4}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
        />
      </label>
      <div className="md:col-span-2 rounded-lg border border-border bg-background-elevated/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Unlock requirements</p>
        <label className="mt-3 block">
          <span className="text-xs text-muted">Minimum level</span>
          <input
            type="number"
            min={1}
            value={formLab.unlockRequirements?.minLevel ?? 1}
            onChange={(e) => patchUnlockRequirements({ minLevel: Math.max(1, Number(e.target.value) || 1) })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-xs text-muted">Prerequisite lab ids (comma-separated)</span>
          <input
            value={(formLab.unlockRequirements?.requiredLabs ?? []).join(', ')}
            onChange={(e) =>
              patchUnlockRequirements({
                requiredLabs: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              })
            }
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
          />
        </label>
      </div>
    </dl>
  )
}

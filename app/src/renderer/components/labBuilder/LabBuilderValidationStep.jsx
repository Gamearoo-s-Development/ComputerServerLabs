/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'

const VALIDATION_TYPES = [
  'fileExists',
  'command',
  'httpResponse',
  'serviceRunning',
  'portOpen',
  'userExists',
  'permission',
  'packageInstalled',
  'textAnswer'
]

/**
 * @param {{ formLab: object, patchLabField: (path: string, value: unknown) => void, validateSh: string, setValidateSh: (v: string) => void, markDirty: () => void }} props
 */
export default function LabBuilderValidationStep({
  formLab,
  patchLabField,
  validateSh,
  setValidateSh,
  markDirty
}) {
  const validation = formLab.validation ?? { type: 'fileExists', path: '/tmp/lab-complete' }

  function patchValidation(partial) {
    patchLabField('validation', { ...validation, ...partial })
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted">
        Final lab validation runs inside the target container only — never on the host. Use objectives for step-by-step
        checks.
      </p>
      <dl className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="text-xs text-muted">Validation type</span>
          <select
            value={validation.type ?? 'fileExists'}
            onChange={(e) => patchValidation({ type: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
          >
            {VALIDATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {validation.type === 'fileExists' && (
          <label>
            <span className="text-xs text-muted">File path</span>
            <input
              value={validation.path ?? ''}
              onChange={(e) => patchValidation({ path: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
            />
          </label>
        )}
        {validation.type === 'httpResponse' && (
          <>
            <label className="md:col-span-2">
              <span className="text-xs text-muted">URL</span>
              <input
                value={validation.url ?? ''}
                onChange={(e) => patchValidation({ url: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
              />
            </label>
            <label>
              <span className="text-xs text-muted">Expected HTTP status</span>
              <input
                type="number"
                value={validation.expectedStatus ?? 200}
                onChange={(e) => patchValidation({ expectedStatus: Number(e.target.value) || 200 })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              />
            </label>
          </>
        )}
        {validation.type === 'command' && (
          <label className="md:col-span-2">
            <span className="text-xs text-muted">Command (runs in container)</span>
            <input
              value={validation.command ?? ''}
              onChange={(e) => patchValidation({ command: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
            />
          </label>
        )}
        {validation.type === 'portOpen' && (
          <label>
            <span className="text-xs text-muted">Port</span>
            <input
              type="number"
              value={validation.port ?? 22}
              onChange={(e) => patchValidation({ port: Number(e.target.value) || 22 })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
            />
          </label>
        )}
      </dl>
      <label className="block">
        <span className="text-xs text-muted">validate.sh (advanced — optional extra checks)</span>
        <textarea
          value={validateSh}
          onChange={(e) => {
            setValidateSh(e.target.value)
            markDirty()
          }}
          rows={10}
          spellCheck={false}
          className="mt-1 w-full rounded-lg border border-border bg-background-elevated/80 p-3 font-mono text-xs text-gray-100"
        />
      </label>
    </div>
  )
}

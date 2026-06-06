/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { Button } from '../ui/index.js'

/**
 * @param {{ formLab: object, patchLabField: (path: string, value: unknown) => void }} props
 */
export default function LabBuilderHintsStep({ formLab, patchLabField }) {
  const hints = formLab.hints ?? []

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted">
        Prefer <strong className="text-white">objectivesPublic[].hint</strong> on each step — learners reveal one hint
        per objective (optional XP penalty in app config). Legacy global hints below map to objectives by order when
        per-step hints are missing.
      </p>
      <label className="block">
        <span className="text-xs text-muted">Legacy global hints (one per line, optional)</span>
        <textarea
          value={hints.join('\n')}
          onChange={(e) =>
            patchLabField(
              'hints',
              e.target.value
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          rows={8}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
          placeholder="Check service status with systemctl&#10;Review logs under /var/log/nginx/"
        />
      </label>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => patchLabField('hints', [...hints, ''])}
      >
        Add empty hint row
      </Button>
    </div>
  )
}

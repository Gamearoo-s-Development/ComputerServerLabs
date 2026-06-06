/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { Button, Card } from '../ui/index.js'
import { cn } from '../../utils/cn.js'

/**
 * @param {{ scan: object | null, onRefresh: () => void, working: boolean }} props
 */
export default function LabBuilderSafetyStep({ scan, onRefresh, working }) {
  const issues = scan?.safety?.issues ?? []

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Review risks before export or Docker Build/Test. Blocked issues stop export unless Developer Mode unsafe override
        is enabled in Settings.
      </p>
      {scan?.schemaValid === false ? (
        <Card className="!p-4 border-warning/40">
          <p className="text-sm font-medium text-warning">Schema / strict checklist</p>
          <ul className="mt-2 list-inside list-disc text-xs text-muted">
            {(scan.schemaErrors ?? []).map((err, i) => (
              <li key={i}>{String(err)}</li>
            ))}
          </ul>
        </Card>
      ) : scan ? (
        <p className="text-sm text-success">Passes catalog schema validation for export.</p>
      ) : null}

      <Card className="!p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-muted-dim">Safety scan</p>
          <Button variant="ghost" size="sm" disabled={working} onClick={onRefresh}>
            Refresh
          </Button>
        </div>
        <ul className="mt-3 max-h-96 space-y-2 overflow-auto text-xs">
          {!issues.length ? (
            <li className="text-muted">No issues reported.</li>
          ) : (
            issues.map((issue, i) => (
              <li
                key={i}
                className={cn(
                  'rounded border px-3 py-2',
                  issue.severity === 'blocked' && 'border-danger/40 bg-danger/10 text-danger',
                  issue.severity === 'warning' && 'border-warning/30 text-warning',
                  issue.severity === 'info' && 'border-border text-muted'
                )}
              >
                <span className="font-semibold uppercase">{issue.severity}</span> — {issue.message}
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  )
}

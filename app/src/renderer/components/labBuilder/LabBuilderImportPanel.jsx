/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState } from 'react'
import { Button, Card } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'

const PRESETS = [
  { id: 'website', label: 'Website folder', dest: '/var/www/html', scope: 'target', stage: 'build' },
  { id: 'nginx', label: 'NGINX config file', dest: '/etc/nginx/conf.d/default.conf', scope: 'target', stage: 'build' },
  { id: 'login-notes', label: 'Case notes (login dir)', dest: '{{LOGIN_DIR}}/case-notes.txt', scope: 'target', stage: 'runtime' },
  { id: 'logs', label: 'App logs folder', dest: '/var/log/app', scope: 'target', stage: 'build' },
  { id: 'ws-notes', label: 'Workstation notes', dest: '/home/{{USERNAME}}/notes.txt', scope: 'workstation', stage: 'runtime' }
]

/**
 * @param {{
 *   draftId: string | null
 *   formLab: object
 *   applyLabUpdate: (lab: object) => void
 *   onImported?: () => void
 * }} props
 */
export default function LabBuilderImportPanel({ draftId, formLab, applyLabUpdate, onImported }) {
  const [importing, setImporting] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [destPath, setDestPath] = useState('/var/www/html')
  const [scope, setScope] = useState('target')
  const [stage, setStage] = useState('build')

  async function runImport(presetDest) {
    if (!draftId) return
    const api = getApi()
    setImporting(true)
    setLastResult(null)
    try {
      const res = await api?.labBuilder?.importAssets?.({
        draftId,
        destPath: presetDest ?? destPath,
        scope,
        stage,
        renderVariables: true
      })
      if (res?.ok && res.data?.lab) {
        applyLabUpdate(res.data.lab)
        setLastResult({ ok: true, message: res.data.message ?? 'Import applied.' })
        onImported?.()
      } else {
        setLastResult({ ok: false, message: res?.error?.message ?? 'Import failed.' })
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card className="!p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Import files / folders</p>
      <p className="mt-1 text-xs text-muted">
        Pick files or a folder from your PC. They are copied into the draft and registered in the lab filesystem manifest.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-xs text-muted">Destination path in container</span>
          <input
            value={destPath}
            onChange={(e) => setDestPath(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">Target</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
          >
            <option value="target">Lab target container</option>
            <option value="workstation">Workstation container</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">Stage</span>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
          >
            <option value="build">Build-time (baked into image)</option>
            <option value="runtime">Runtime (per session)</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={importing || !draftId} onClick={() => void runImport()}>
          {importing ? 'Importing…' : 'Choose files to import…'}
        </Button>
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            variant="secondary"
            size="sm"
            disabled={importing || !draftId}
            onClick={() => {
              setDestPath(p.dest)
              setScope(p.scope)
              setStage(p.stage)
              void runImport(p.dest)
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {lastResult ? (
        <p className={`mt-2 text-xs ${lastResult.ok ? 'text-success' : 'text-danger'}`}>{lastResult.message}</p>
      ) : null}
    </Card>
  )
}

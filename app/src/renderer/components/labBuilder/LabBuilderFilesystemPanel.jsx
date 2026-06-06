/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useMemo, useState } from 'react'
import { Button, Card } from '../ui/index.js'
import { cn } from '../../utils/cn.js'

const TEMPLATE_VARS = [
  '{{LOGIN_DIR}}',
  '{{LOGIN_USER}}',
  '{{USERNAME}}',
  '{{PASSWORD}}',
  '{{LAB_ID}}',
  '{{SESSION_ID}}',
  '{{TARGET_HOST}}',
  '{{TARGET_IP}}',
  '{{TARGET_SSH_PORT}}',
  '{{FLAG_TEXT}}',
  '{{FLAG_FILENAME}}',
  '{{FLAG_PATH}}',
  '{{RANDOM_SEED}}'
]

/**
 * @param {object} lab
 */
function ensureFilesystem(lab) {
  const filesystem = lab.filesystem ?? {
    target: { files: lab.files ?? [], directories: lab.directories ?? [], symlinks: [] },
    workstation: {
      files: lab.workstation?.custom?.files ?? [],
      directories: lab.workstation?.custom?.directories ?? [],
      symlinks: []
    }
  }
  return filesystem
}

/**
 * @param {{
 *   formLab: object
 *   applyLabUpdate: (lab: object) => void
 *   treePreview?: { target: string[], workstation: string[], loginDirPreview?: string } | null
 * }} props
 */
export default function LabBuilderFilesystemPanel({ formLab, applyLabUpdate, treePreview }) {
  const [scope, setScope] = useState('target')
  const [fileIdx, setFileIdx] = useState(0)

  const filesystem = useMemo(() => ensureFilesystem(formLab), [formLab])
  const targetUser = formLab.targetUser ?? { mode: 'generated-user', allowRoot: false, loginDirectory: 'auto' }
  const isTarget = scope === 'target'
  const scopeData = isTarget ? filesystem.target : filesystem.workstation
  const files = scopeData.files ?? []
  const directories = scopeData.directories ?? []
  const currentFile = files[fileIdx] ?? {
    path: isTarget ? '{{LOGIN_DIR}}/case-notes.txt' : '/home/{{USERNAME}}/connection-notes.txt',
    content: '',
    owner: isTarget ? '{{LOGIN_USER}}' : '{{USERNAME}}',
    group: isTarget ? '{{LOGIN_USER}}' : '{{USERNAME}}',
    mode: '0644',
    stage: 'runtime'
  }

  function patchLab(partial) {
    applyLabUpdate({ ...formLab, ...partial })
  }

  function patchFilesystem(nextFs) {
    patchLab({
      filesystem: nextFs,
      files: nextFs.target.files,
      directories: nextFs.target.directories,
      workstation: formLab.workstation?.custom
        ? {
            ...formLab.workstation,
            custom: {
              ...formLab.workstation.custom,
              files: nextFs.workstation.files,
              directories: nextFs.workstation.directories
            }
          }
        : formLab.workstation
    })
  }

  function updateScope(partial) {
    const fs = ensureFilesystem(formLab)
    const next = {
      ...fs,
      [scope]: { ...fs[scope], ...partial }
    }
    patchFilesystem(next)
  }

  function updateFile(idx, partial) {
    const nextFiles = [...files]
    nextFiles[idx] = { ...nextFiles[idx], ...partial }
    updateScope({ files: nextFiles })
  }

  function addFile(defaults = {}) {
    const nextFiles = [
      ...files,
      {
        path: defaults.path ?? (isTarget ? '{{LOGIN_DIR}}/notes.txt' : '/home/{{USERNAME}}/notes.txt'),
        content: defaults.content ?? '',
        owner: isTarget ? '{{LOGIN_USER}}' : '{{USERNAME}}',
        group: isTarget ? '{{LOGIN_USER}}' : '{{USERNAME}}',
        mode: '0644',
        stage: 'runtime',
        ...defaults
      }
    ]
    setFileIdx(nextFiles.length - 1)
    updateScope({ files: nextFiles })
  }

  function addLoginDirFile() {
    addFile({
      path: isTarget ? '{{LOGIN_DIR}}/case-notes.txt' : '/home/{{USERNAME}}/connection-notes.txt',
      content: isTarget
        ? 'Investigate the lab target using the clues below.'
        : 'Use this workstation to SSH into the lab target.'
    })
  }

  function addDirectory() {
    const nextDirs = [
      ...directories,
      {
        path: isTarget ? '{{LOGIN_DIR}}/notes' : '/home/{{USERNAME}}/workspace',
        owner: isTarget ? '{{LOGIN_USER}}' : '{{USERNAME}}',
        group: isTarget ? '{{LOGIN_USER}}' : '{{USERNAME}}',
        mode: '0755',
        stage: 'runtime'
      }
    ]
    updateScope({ directories: nextDirs })
  }

  function removeFile(idx) {
    updateScope({ files: files.filter((_, i) => i !== idx) })
    setFileIdx(0)
  }

  function patchTargetUser(partial) {
    const next = { ...targetUser, ...partial }
    if (next.mode === 'root' && !next.allowRoot) {
      next.mode = 'generated-user'
    }
    patchLab({ targetUser: next })
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Target login user</h3>
        <p className="mt-1 text-xs text-muted">
          Workstations always use a generated normal user — never root. Target container login is configured here.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs text-muted">Login mode</span>
            <select
              value={targetUser.mode ?? 'generated-user'}
              onChange={(e) => {
                const mode = e.target.value
                patchTargetUser({
                  mode,
                  allowRoot: mode === 'root' ? true : targetUser.allowRoot
                })
              }}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
            >
              <option value="generated-user">Generated user (default)</option>
              <option value="root">Root / admin (restricted)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm md:mt-6">
            <input
              type="checkbox"
              checked={targetUser.allowRoot === true}
              disabled={targetUser.mode !== 'root'}
              onChange={(e) => patchTargetUser({ allowRoot: e.target.checked, mode: 'root' })}
              className="rounded border-border"
            />
            Allow root login on lab target
          </label>
        </div>
        {targetUser.mode === 'root' && targetUser.allowRoot ? (
          <p className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            Root access is allowed inside the lab container only. Use only when root/admin repair is the intended
            skill. {{LOGIN_DIR}} resolves to /root for these labs.
          </p>
        ) : null}
      </Card>

      <Card className="!p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'target', label: 'Lab target filesystem' },
            { id: 'workstation', label: 'Workstation filesystem' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setScope(tab.id)
                setFileIdx(0)
              }}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs',
                scope === tab.id ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          {isTarget
            ? 'Files and directories created inside the lab target only (not the workstation).'
            : 'Files created inside the investigation workstation only — never on the lab target.'}
        </p>
        <p className="mt-1 text-xs text-muted-dim">Variables: {TEMPLATE_VARS.join(', ')}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => addFile()}>
            Add file to {isTarget ? 'lab target' : 'workstation'}
          </Button>
          <Button variant="secondary" size="sm" onClick={addLoginDirFile}>
            Place file in login directory
          </Button>
          <Button variant="ghost" size="sm" onClick={addDirectory}>
            Add directory
          </Button>
        </div>

        {files.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2 flex flex-wrap gap-2">
              {files.length > 1 ? (
                <select
                  value={fileIdx}
                  onChange={(e) => setFileIdx(Number(e.target.value))}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-white"
                >
                  {files.map((f, i) => (
                    <option key={i} value={i}>
                      {f.path || `File ${i + 1}`}
                    </option>
                  ))}
                </select>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => removeFile(fileIdx)}>
                Remove file
              </Button>
            </div>
            <label className="md:col-span-2 block text-sm">
              <span className="text-xs text-muted">Path</span>
              <input
                value={currentFile.path ?? ''}
                onChange={(e) => updateFile(fileIdx, { path: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted">Owner</span>
              <input
                value={currentFile.owner ?? ''}
                onChange={(e) => updateFile(fileIdx, { owner: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted">Group</span>
              <input
                value={currentFile.group ?? ''}
                onChange={(e) => updateFile(fileIdx, { group: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted">Mode</span>
              <input
                value={currentFile.mode ?? '0644'}
                onChange={(e) => updateFile(fileIdx, { mode: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted">Stage</span>
              <select
                value={currentFile.stage ?? 'runtime'}
                onChange={(e) => updateFile(fileIdx, { stage: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              >
                <option value="runtime">Runtime (variables rendered per session)</option>
                <option value="build">Build-time (baked into image)</option>
              </select>
            </label>
            <label className="md:col-span-2 block text-sm">
              <span className="text-xs text-muted">Content</span>
              <textarea
                value={currentFile.content ?? ''}
                onChange={(e) => updateFile(fileIdx, { content: e.target.value })}
                rows={8}
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-gray-100"
              />
            </label>
            <p className="md:col-span-2 text-xs text-muted-dim">
              Upload binary files by placing them under <code className="text-accent">labs/&lt;id&gt;/files/</code>{' '}
              for build-time COPY, or paste text content here for runtime manifests.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-dim">No files defined for this scope yet.</p>
        )}

        {directories.length ? (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-dim">Directories</p>
            <ul className="mt-1 text-xs text-gray-300">
              {directories.map((d, i) => (
                <li key={i} className="font-mono">
                  {d.path} ({d.mode ?? '0755'})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {treePreview ? (
        <Card className="!p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Generated file tree preview</h3>
          {treePreview.loginDirPreview ? (
            <p className="mt-1 text-xs text-muted">
              Sample login directory: <code className="text-accent">{treePreview.loginDirPreview}</code>
            </p>
          ) : null}
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-accent">Lab target</p>
              <pre className="mt-1 overflow-auto rounded bg-background p-2 font-mono text-[11px] text-gray-300">
                {treePreview.target?.join('\n')}
              </pre>
            </div>
            <div>
              <p className="text-xs font-medium text-accent">Workstation</p>
              <pre className="mt-1 overflow-auto rounded bg-background p-2 font-mono text-[11px] text-gray-300">
                {treePreview.workstation?.join('\n')}
              </pre>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  )
}

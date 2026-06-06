/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { Button, Card } from '../ui/index.js'
import { cn } from '../../utils/cn.js'

const OFFICIAL_BASES = [
  { id: 'ubuntu-22.04', label: 'Ubuntu 22.04', image: 'ubuntu:22.04' },
  { id: 'ubuntu-24.04', label: 'Ubuntu 24.04', image: 'ubuntu:24.04' },
  { id: 'debian-bookworm', label: 'Debian Bookworm', image: 'debian:bookworm' },
  { id: 'alpine-latest', label: 'Alpine (latest)', image: 'alpine:latest' }
]

const DEFAULT_CUSTOM = {
  enabled: true,
  id: 'custom-workstation',
  name: 'Custom Lab Workstation',
  baseImage: 'ubuntu:22.04',
  baseImageId: 'ubuntu-22.04',
  sourceType: 'generated',
  runtime: 'linux',
  packages: ['openssh-client', 'curl', 'nano', 'vim', 'netcat-openbsd'],
  files: [],
  directories: [],
  environment: {},
  startupMessage: 'Use this workstation to connect to the lab target.'
}

/**
 * @param {{
 *   formLab: object
 *   applyLabUpdate: (lab: object) => void
 * }} props
 */
export default function LabBuilderCustomWorkstation({ formLab, applyLabUpdate }) {
  const custom = formLab.workstation?.custom ?? {}
  const enabled = custom.enabled === true

  function patchWorkstation(partial) {
    applyLabUpdate({
      ...formLab,
      labMode: 'target-plus-workstation',
      workstation: {
        ...(formLab.workstation ?? {}),
        ...partial
      }
    })
  }

  function patchCustom(partial) {
    patchWorkstation({
      custom: { ...custom, ...partial }
    })
  }

  function toggleEnabled(checked) {
    if (!checked) {
      patchWorkstation({ custom: { ...custom, enabled: false } })
      return
    }
    const supported = new Set([
      ...(formLab.workstation?.supported ?? []),
      'custom',
      'ubuntu-terminal',
      'debian-terminal'
    ])
    patchWorkstation({
      recommended: formLab.workstation?.recommended ?? 'custom',
      supported: [...supported],
      custom: { ...DEFAULT_CUSTOM, ...custom, enabled: true }
    })
  }

  return (
    <Card className="!p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Custom Workstation</h3>
      <p className="mt-2 text-xs text-muted">
        A separate investigation environment — tools, client configs, and files stay off the lab target so learners
        are not spoiled.
      </p>

      <label className="mt-4 flex items-center gap-2 text-sm text-gray-200">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggleEnabled(e.target.checked)}
          className="rounded border-border"
        />
        This lab uses a custom workstation image
      </label>

      {enabled ? (
        <div className="mt-4 space-y-4">
          <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            Workstation files may help the user investigate. Do not place final answers here.
          </p>

          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={formLab.workstation?.required === true}
              onChange={(e) =>
                patchWorkstation({
                  required: e.target.checked,
                  requiredProfile: e.target.checked ? 'custom' : undefined,
                  recommended: 'custom',
                  reason:
                    formLab.workstation?.reason ??
                    'This lab requires the custom workstation (investigation files and tools are only on the workstation).'
                })
              }
              className="rounded border-border"
            />
            Require custom workstation (learners cannot pick a generic workstation)
          </label>

          <label className="block text-sm">
            <span className="text-xs text-muted">Runtime</span>
            <select
              value={custom.runtime ?? 'linux'}
              onChange={(e) => patchCustom({ runtime: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
            >
              <option value="linux">Linux terminal workstation</option>
              <option value="windows">Windows PowerShell workstation (Windows containers)</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-xs text-muted">Display name</span>
            <input
              value={custom.name ?? ''}
              onChange={(e) => patchCustom({ name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
            />
          </label>

          {custom.runtime !== 'windows' ? (
            <label className="block text-sm">
              <span className="text-xs text-muted">Base image</span>
              <select
                value={custom.baseImageId ?? 'ubuntu-22.04'}
                onChange={(e) => {
                  const base = OFFICIAL_BASES.find((b) => b.id === e.target.value)
                  patchCustom({
                    baseImageId: e.target.value,
                    baseImage: base?.image ?? 'ubuntu:22.04'
                  })
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              >
                {OFFICIAL_BASES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({b.image})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-muted">
              Windows custom workstations use the Windows Server Core base image (PowerShell terminal — not a GUI
              desktop). Learners need Docker Desktop on Windows in Windows containers mode; you can author this lab on
              any host.
            </p>
          )}

          <label className="block text-sm">
            <span className="text-xs text-muted">Extra packages (comma-separated)</span>
            <input
              value={(custom.packages ?? []).join(', ')}
              onChange={(e) =>
                patchCustom({
                  packages: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                })
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              placeholder="jq, git, nmap"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs text-muted">Startup message (MOTD)</span>
            <textarea
              value={custom.startupMessage ?? ''}
              onChange={(e) => patchCustom({ startupMessage: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white"
            />
          </label>

          <p className="text-xs text-muted">
            Workstation files are managed on the <strong className="text-white">Filesystem</strong> tab (workstation
            scope). Workstations always use a normal user home — never root.
          </p>

          <p className={cn('text-xs text-muted')}>
            Image tag: <code className="text-accent">sysadmin-game/workstation-{formLab.id ?? 'lab-id'}:latest</code>
          </p>
        </div>
      ) : null}
    </Card>
  )
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { Button, Card } from '../ui/index.js'

const SERVICE_PRESETS = [
  { id: 'ssh', label: 'SSH', port: 22, purpose: 'ssh' },
  { id: 'nginx', label: 'NGINX', port: 80, purpose: 'web' },
  { id: 'apache', label: 'Apache', port: 80, purpose: 'web' },
  { id: 'python-http', label: 'Python HTTP', port: 8000, purpose: 'web' },
  { id: 'cron', label: 'Cron', port: null, purpose: 'cron' }
]

/**
 * @param {{ formLab: object, applyLabUpdate: (lab: object) => void }} props
 */
export default function LabBuilderServicesStep({ formLab, applyLabUpdate }) {
  const services = formLab.docker?.services ?? []
  const ports = formLab.docker?.ports ?? []

  function patchDocker(partial) {
    applyLabUpdate({
      ...formLab,
      docker: { ...(formLab.docker ?? {}), ...partial }
    })
  }

  function toggleService(id) {
    const next = services.includes(id) ? services.filter((s) => s !== id) : [...services, id]
    patchDocker({ services: next })
  }

  function addPort(preset) {
    if (!preset.port) return
    const exists = ports.some((p) => (p.container ?? p.containerPort) === preset.port)
    if (exists) return
    patchDocker({
      ports: [
        ...ports,
        {
          containerPort: preset.port,
          protocol: 'tcp',
          purpose: preset.purpose,
          label: preset.label,
          exposeToHost: preset.purpose === 'web',
          showToUser: preset.purpose === 'web'
        }
      ]
    })
  }

  function updatePort(i, partial) {
    const next = [...ports]
    next[i] = { ...next[i], ...partial }
    patchDocker({ ports: next })
  }

  function removePort(i) {
    patchDocker({ ports: ports.filter((_, j) => j !== i) })
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <p className="text-xs font-semibold uppercase text-muted-dim">Install services (packages)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SERVICE_PRESETS.map((s) => (
            <Button
              key={s.id}
              variant={services.includes(s.id) ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                toggleService(s.id)
                if (s.port) addPort(s)
              }}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="!p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-muted-dim">Exposed ports / lab services</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              patchDocker({
                ports: [
                  ...ports,
                  {
                    containerPort: 22,
                    protocol: 'tcp',
                    purpose: 'ssh',
                    label: 'SSH',
                    exposeToHost: false,
                    showToUser: false
                  }
                ]
              })
            }
          >
            Add port
          </Button>
        </div>
        <ul className="mt-3 space-y-3">
          {ports.map((p, i) => (
            <li key={i} className="rounded-lg border border-border p-3">
              <div className="grid gap-2 md:grid-cols-3">
                <label className="text-xs">
                  Container port
                  <input
                    type="number"
                    value={p.containerPort ?? p.container ?? ''}
                    onChange={(e) => updatePort(i, { containerPort: Number(e.target.value) })}
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-white"
                  />
                </label>
                <label className="text-xs">
                  Purpose
                  <input
                    value={p.purpose ?? ''}
                    onChange={(e) => updatePort(i, { purpose: e.target.value })}
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-white"
                  />
                </label>
                <label className="text-xs">
                  Label (learner UI)
                  <input
                    value={p.label ?? ''}
                    onChange={(e) => updatePort(i, { label: e.target.value })}
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-white"
                  />
                </label>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.exposeToHost !== false}
                    onChange={(e) => updatePort(i, { exposeToHost: e.target.checked })}
                  />
                  Publish host route
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.showToUser === true}
                    onChange={(e) => updatePort(i, { showToUser: e.target.checked })}
                  />
                  Show in Lab Services (non-spoiling URL)
                </label>
                <Button variant="ghost" size="sm" onClick={() => removePort(i)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {!ports.length ? <p className="mt-2 text-xs text-muted">No ports — add SSH (22) for terminal labs.</p> : null}
      </Card>
    </div>
  )
}

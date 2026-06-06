/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useMemo, useState } from 'react'
import { Button, Card } from '../ui/index.js'
import { cn } from '../../utils/cn.js'
import Modal from '../ui/Modal.jsx'
import LabBuilderCustomWorkstation from './LabBuilderCustomWorkstation.jsx'
const OFFICIAL_BASES = [
  { id: 'ubuntu-22.04', label: 'Ubuntu 22.04', image: 'ubuntu:22.04' },
  { id: 'ubuntu-24.04', label: 'Ubuntu 24.04', image: 'ubuntu:24.04' },
  { id: 'debian-bookworm', label: 'Debian Bookworm', image: 'debian:bookworm' },
  { id: 'alpine-latest', label: 'Alpine (latest)', image: 'alpine:latest' },
  { id: 'nginx-stable', label: 'NGINX (stable)', image: 'nginx:stable' },
  { id: 'node-lts', label: 'Node.js LTS', image: 'node:lts' },
  { id: 'python-3', label: 'Python 3', image: 'python:3' },
  { id: 'httpd-latest', label: 'Apache httpd', image: 'httpd:latest' }
]

const SERVICE_OPTIONS = [
  { id: 'ssh', label: 'OpenSSH (port 22)' },
  { id: 'nginx', label: 'NGINX (port 80)' },
  { id: 'apache', label: 'Apache httpd' },
  { id: 'cron', label: 'Cron' },
  { id: 'python-http', label: 'Python HTTP server (:8000)' }
]

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
 * @param {{
 *   formLab: object
 *   applyLabUpdate: (lab: object) => void
 *   imageTrust: object | null
 *   developerMode: boolean
 *   scan: object | null
 *   api: object
 *   selectedId: string | null
 *   dockerfile: string
 *   entrypointSh: string
 *   validateSh: string
 *   readme: string
 * }} props
 */
export default function LabBuilderDockerPanel({
  formLab,
  applyLabUpdate,
  imageTrust,
  developerMode,
  scan,
  api,
  selectedId,
  dockerfile,
  entrypointSh,
  validateSh,
  readme
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const imageMode = useMemo(() => {
    if (formLab.docker?.builderGenerated === true) return 'generated'
    if (formLab.docker?.imageSource === 'prebuilt') return 'prebuilt'
    return 'custom-dockerfile'
  }, [formLab.docker?.builderGenerated, formLab.docker?.imageSource])

  function patchDocker(partial) {
    applyLabUpdate({
      ...formLab,
      docker: { ...(formLab.docker ?? {}), ...partial }
    })
  }

  function setImageMode(mode) {
    if (mode === 'generated') {
      applyLabUpdate({
        ...formLab,
        docker: {
          ...(formLab.docker ?? {}),
          builderGenerated: true,
          imageSource: 'local-build',
          buildPath: formLab.docker?.buildPath ?? '.'
        }
      })
    } else if (mode === 'prebuilt') {
      applyLabUpdate({
        ...formLab,
        docker: {
          ...(formLab.docker ?? {}),
          builderGenerated: false,
          imageSource: 'prebuilt'
        }
      })
    } else {
      applyLabUpdate({
        ...formLab,
        docker: {
          ...(formLab.docker ?? {}),
          builderGenerated: false,
          imageSource: 'local-build',
          buildPath: formLab.docker?.buildPath ?? '.'
        }
      })
    }
  }

  function toggleService(id) {
    const cur = formLab.docker?.services ?? []
    const next = cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]
    patchDocker({ services: next })
  }

  async function openPreview() {
    setPreviewLoading(true)
    try {
      const res = await api?.labBuilder?.previewLab?.({
        lab: formLab,
        dockerfile,
        entrypointSh,
        validateSh,
        readme
      })
      if (res?.ok) {
        setPreviewData(res.data)
        setPreviewOpen(true)
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  async function applyMockWebsite() {
    if (!selectedId || !api?.labBuilder?.applyMockWebsite) return
    const res = await api.labBuilder.applyMockWebsite(selectedId)
    if (res?.ok && res.data?.lab) {
      applyLabUpdate(res.data.lab)
    } else if (res?.ok && res.data?.files?.labJsonRaw) {
      try {
        applyLabUpdate(JSON.parse(res.data.files.labJsonRaw))
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={previewLoading} onClick={() => void openPreview()}>
          Review What This Lab Will Do
        </Button>
        <Button variant="secondary" size="sm" disabled={!selectedId} onClick={() => void applyMockWebsite()}>
          Add Mock Website template
        </Button>
      </div>

      <Section title="Base Image">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'generated', label: 'Generated (official base)' },
            { id: 'prebuilt', label: 'Prebuilt registry image' },
            { id: 'custom-dockerfile', label: 'Advanced Dockerfile' }
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setImageMode(m.id)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs',
                imageMode === m.id ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {imageMode === 'generated' ? (
          <label className="mt-3 block text-sm">
            <span className="text-xs text-muted">Official base</span>
            <select
              value={formLab.docker?.baseImageId ?? 'ubuntu-22.04'}
              onChange={(e) => {
                const base = OFFICIAL_BASES.find((b) => b.id === e.target.value)
                patchDocker({
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
        ) : null}
        {imageMode === 'prebuilt' ? (
          <label className="mt-3 block text-sm">
            <span className="text-xs text-muted">Docker image tag</span>
            <input
              value={formLab.docker?.image ?? ''}
              onChange={(e) => patchDocker({ image: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
              placeholder="nginx:stable"
            />
            {imageTrust ? (
              <p className="mt-2 text-xs text-muted">
                {imageTrust.badgeLabel} — {imageTrust.publisher}
                {(imageTrust.badge === 'community' || imageTrust.badge === 'unverified') && (
                  <span className="text-warning"> (unofficial — review before publishing)</span>
                )}
              </p>
            ) : null}
          </label>
        ) : null}
        {imageMode === 'custom-dockerfile' ? (
          <p className="mt-2 text-xs text-warning">
            Local Build Image — edit the Dockerfile tab directly. Safety scan applies to file contents.
          </p>
        ) : null}
      </Section>

      <Section title="Packages">
        <label className="block text-sm">
          <span className="text-xs text-muted">Extra apt packages (comma-separated)</span>
          <input
            value={(formLab.docker?.packages ?? []).join(', ')}
            onChange={(e) =>
              patchDocker({
                packages: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              })
            }
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
            placeholder="curl, vim, jq"
          />
        </label>
      </Section>

      <Section title="Users & Credentials">
        <p className="text-xs text-muted">
          Usernames and passwords are generated per session — use {'{{USERNAME}}'} and {'{{PASSWORD}}'} in file
          paths. Secrets are redacted in preview unless Developer Mode is on.
        </p>
      </Section>

      <LabBuilderCustomWorkstation formLab={formLab} applyLabUpdate={applyLabUpdate} />

      <Section title="Filesystem">
        <p className="text-xs text-muted">
          Define target and workstation files on the <strong className="text-white">Filesystem</strong> tab —
          including login-directory notes, web roots, and configs. Use {'{{LOGIN_DIR}}'} for the session home.
        </p>
      </Section>

      <Section title="Services">
        <div className="flex flex-wrap gap-3">
          {SERVICE_OPTIONS.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-xs text-gray-200">
              <input
                type="checkbox"
                checked={(formLab.docker?.services ?? []).includes(s.id)}
                onChange={() => toggleService(s.id)}
                className="rounded border-border"
              />
              {s.label}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Ports & routes">
        <p className="text-xs text-muted">
          Published services appear at 127.0.0.1 on a random host port during missions.
        </p>
        <ul className="mt-2 space-y-1 text-xs text-gray-300">
          {(formLab.docker?.ports ?? []).map((p, i) => (
            <li key={i}>
              {p.label ?? p.purpose ?? 'port'} — container {(p.container ?? p.containerPort)}/{p.protocol ?? 'tcp'}
              {p.exposeToHost !== false ? ' → http://127.0.0.1:&lt;host-port&gt;' : ' (internal only)'}
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => {
            const ports = [...(formLab.docker?.ports ?? [])]
            ports.push({
              containerPort: 80,
              protocol: 'tcp',
              purpose: 'web',
              label: 'Web Service',
              exposeToHost: true,
              showToUser: true
            })
            patchDocker({ ports })
          }}
        >
          Add web port 80
        </Button>
      </Section>

      <Section title="Environment variables">
        <textarea
          rows={4}
          value={JSON.stringify(formLab.docker?.env ?? {}, null, 2)}
          onChange={(e) => {
            try {
              const env = JSON.parse(e.target.value)
              patchDocker({ env })
            } catch {
              // ignore invalid JSON while typing
            }
          }}
          spellCheck={false}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-gray-100"
        />
      </Section>

      <Section title="Startup commands">
        {(formLab.docker?.startupCommands ?? []).map((cmd, i) => (
          <div key={i} className="mb-2 rounded-lg border border-border/60 p-2">
            <input
              value={cmd.label ?? ''}
              onChange={(e) => {
                const cmds = [...(formLab.docker?.startupCommands ?? [])]
                cmds[i] = { ...cmds[i], label: e.target.value }
                patchDocker({ startupCommands: cmds })
              }}
              placeholder="Label"
              className="mb-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-white"
            />
            <input
              value={cmd.command ?? ''}
              onChange={(e) => {
                const cmds = [...(formLab.docker?.startupCommands ?? [])]
                cmds[i] = { ...cmds[i], command: e.target.value }
                patchDocker({ startupCommands: cmds })
              }}
              placeholder="Command"
              className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs text-white"
            />
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            patchDocker({
              startupCommands: [
                ...(formLab.docker?.startupCommands ?? []),
                { label: 'Setup', command: 'echo setup', runAs: 'root', when: 'before-ssh' }
              ]
            })
          }
        >
          Add startup command
        </Button>
      </Section>

      <Section title="Validation">
        <label className="block text-sm">
          <span className="text-xs text-muted">Check type</span>
          <select
            value={formLab.validation?.type ?? 'fileExists'}
            onChange={(e) =>
              applyLabUpdate({
                ...formLab,
                validation: { ...(formLab.validation ?? {}), type: e.target.value }
              })
            }
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
          >
            {VALIDATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-2 block text-sm">
          <span className="text-xs text-muted">Path / URL / command (as required by type)</span>
          <input
            value={formLab.validation?.path ?? formLab.validation?.url ?? formLab.validation?.command ?? ''}
            onChange={(e) => {
              const v = formLab.validation ?? { type: 'fileExists' }
              const key = v.type === 'httpResponse' ? 'url' : v.type === 'command' ? 'command' : 'path'
              applyLabUpdate({ ...formLab, validation: { ...v, [key]: e.target.value } })
            }}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
          />
        </label>
      </Section>

      <Section title="Safety review">
        <ul className="max-h-40 space-y-1 overflow-auto text-xs">
          {(scan?.safety?.issues ?? []).length ? (
            scan.safety.issues.map((issue, i) => (
              <li
                key={i}
                className={cn(
                  'rounded border px-2 py-1',
                  issue.severity === 'blocked' && 'border-danger/40 text-danger',
                  issue.severity === 'warning' && 'border-warning/30 text-warning',
                  issue.severity === 'info' && 'border-border text-muted'
                )}
              >
                {issue.severity}: {issue.message}
              </li>
            ))
          ) : (
            <li className="text-muted">Save draft to refresh safety scan.</li>
          )}
        </ul>
      </Section>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Generated preview" size="lg">
        {previewData ? (
          <div className="max-h-[70vh] space-y-4 overflow-auto p-4 text-sm">
            <div>
              <h4 className="font-semibold text-white">Summary</h4>
              <ul className="mt-2 list-inside list-disc text-muted">
                {previewData.summaryBullets?.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
            {previewData.routePreview?.length ? (
              <div>
                <h4 className="font-semibold text-white">Route preview</h4>
                <ul className="mt-1 text-xs text-muted">
                  {previewData.routePreview.map((r, i) => (
                    <li key={i}>
                      {r.label}: {r.url}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!developerMode ? (
              <p className="text-xs text-warning">Secrets are redacted in preview. Enable Developer Mode to see values.</p>
            ) : null}
            <details>
              <summary className="cursor-pointer text-accent">Dockerfile</summary>
              <pre className="mt-2 overflow-auto rounded bg-background p-2 font-mono text-[11px] text-gray-200">
                {previewData.artifacts?.dockerfile}
              </pre>
            </details>
            <details>
              <summary className="cursor-pointer text-accent">entrypoint.sh</summary>
              <pre className="mt-2 overflow-auto rounded bg-background p-2 font-mono text-[11px] text-gray-200">
                {previewData.artifacts?.entrypoint}
              </pre>
            </details>
            <details>
              <summary className="cursor-pointer text-accent">Target files manifest</summary>
              <pre className="mt-2 overflow-auto rounded bg-background p-2 font-mono text-[11px] text-gray-200">
                {previewData.artifacts?.filesManifest}
              </pre>
            </details>
            {previewData.workstation ? (
              <>
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-muted">
                  {previewData.workstation.summaryLine}
                </div>
                <details>
                  <summary className="cursor-pointer text-accent">Workstation Dockerfile</summary>
                  <pre className="mt-2 overflow-auto rounded bg-background p-2 font-mono text-[11px] text-gray-200">
                    {previewData.artifacts?.workstationDockerfile}
                  </pre>
                </details>
                <details>
                  <summary className="cursor-pointer text-accent">Workstation entrypoint</summary>
                  <pre className="mt-2 overflow-auto rounded bg-background p-2 font-mono text-[11px] text-gray-200">
                    {previewData.artifacts?.workstationEntrypoint}
                  </pre>
                </details>
                <details>
                  <summary className="cursor-pointer text-accent">Workstation files</summary>
                  <ul className="mt-2 space-y-2 text-xs text-gray-300">
                    {previewData.workstation.renderedFiles?.map((f, i) => (
                      <li key={i} className="rounded border border-border/60 p-2">
                        <div className="font-mono text-accent">{f.path}</div>
                        <pre className="mt-1 whitespace-pre-wrap text-muted">{f.contentPreview}</pre>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

/**
 * @param {{ title: string, children: React.ReactNode }} props
 */
function Section({ title, children }) {
  return (
    <Card className="!p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">{title}</h3>
      <div className="mt-3">{children}</div>
    </Card>
  )
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useState } from 'react'
import { Button, Card } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { cn } from '../../utils/cn.js'

const FILE_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'labJson', label: 'lab.json' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'compose', label: 'docker-compose.yml' },
  { id: 'entrypoint', label: 'entrypoint.sh' },
  { id: 'workstationDockerfile', label: 'Workstation Dockerfile' },
  { id: 'manifest', label: 'File manifest' },
  { id: 'readme', label: 'README.md' }
]

/**
 * @param {{
 *   formLab: object
 *   dockerfile: string
 *   entrypointSh: string
 *   validateSh: string
 *   readme: string
 *   dockerComposeYaml?: string
 *   developerMode?: boolean
 *   labJsonRaw?: string
 *   onLabJsonChange?: (v: string) => void
 *   onDockerfileChange?: (v: string) => void
 *   onEntrypointChange?: (v: string) => void
 * }} props
 */
export default function LabBuilderPreviewStep({
  formLab,
  dockerfile,
  entrypointSh,
  validateSh,
  readme,
  dockerComposeYaml,
  developerMode = false,
  labJsonRaw,
  onLabJsonChange,
  onDockerfileChange,
  onEntrypointChange
}) {
  const [fileTab, setFileTab] = useState('summary')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const api = getApi()
    if (!formLab || !api?.labBuilder?.previewLab) return
    setLoading(true)
    void api.labBuilder
      .previewLab({ lab: formLab, dockerfile, entrypointSh, validateSh, readme, dockerComposeYaml })
      .then((res) => {
        if (res?.ok) setPreview(res.data)
      })
      .finally(() => setLoading(false))
  }, [formLab, dockerfile, entrypointSh, validateSh, readme, dockerComposeYaml])

  function fileContent() {
    if (!preview) return loading ? 'Loading preview…' : ''
    if (fileTab === 'summary') {
      return (preview.summaryBullets ?? []).map((b) => `• ${b}`).join('\n')
    }
    if (fileTab === 'labJson') return labJsonRaw ?? preview.artifacts?.labJson ?? JSON.stringify(formLab, null, 2)
    if (fileTab === 'dockerfile') return dockerfile || preview.artifacts?.dockerfile || ''
    if (fileTab === 'compose') return dockerComposeYaml ?? '# Single-container lab — no compose file'
    if (fileTab === 'entrypoint') return entrypointSh || preview.artifacts?.entrypoint || ''
    if (fileTab === 'workstationDockerfile') {
      return preview.artifacts?.workstationDockerfile ?? '# No custom workstation'
    }
    if (fileTab === 'manifest') return preview.artifacts?.filesManifest ?? '{}'
    if (fileTab === 'readme') return readme
    return ''
  }

  return (
    <div className="space-y-4">
      {loading ? <p className="text-xs text-muted">Generating preview…</p> : null}
      {preview?.summaryBullets?.length ? (
        <Card className="!p-4">
          <p className="text-xs font-semibold uppercase text-muted-dim">Plain-English summary</p>
          <ul className="mt-2 list-inside list-disc text-sm text-gray-200">
            {preview.summaryBullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {FILE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFileTab(t.id)}
            className={cn(
              'rounded-lg px-2 py-1 text-xs font-medium',
              fileTab === t.id ? 'bg-accent/20 text-accent' : 'text-muted hover:bg-card'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        readOnly={
          !developerMode ||
          (fileTab !== 'labJson' && fileTab !== 'dockerfile' && fileTab !== 'entrypoint')
        }
        value={fileContent()}
        onChange={(e) => {
          const v = e.target.value
          if (fileTab === 'labJson') onLabJsonChange?.(v)
          if (fileTab === 'dockerfile') onDockerfileChange?.(v)
          if (fileTab === 'entrypoint') onEntrypointChange?.(v)
        }}
        rows={18}
        spellCheck={false}
        className="w-full rounded-lg border border-border bg-background-elevated/80 p-3 font-mono text-xs text-gray-100"
      />
      {developerMode ? (
        <p className="text-[10px] text-muted-dim">Developer Mode: lab.json, Dockerfile, and entrypoint are editable here.</p>
      ) : null}
      {preview?.filesystemTree ? (
        <Card className="!p-4">
          <p className="text-xs font-semibold uppercase text-muted-dim">Filesystem tree</p>
          <pre className="mt-2 max-h-48 overflow-auto font-mono text-[10px] text-muted">
            {(preview.filesystemTree.target ?? []).join('\n')}
          </pre>
        </Card>
      ) : null}
    </div>
  )
}

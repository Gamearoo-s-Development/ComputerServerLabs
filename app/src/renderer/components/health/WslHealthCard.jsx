/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState } from 'react'
import { Button, StatusBadge } from '../ui/index.js'
import { cn } from '../../utils/cn.js'
import { statusDisplayLabel, statusDisplayVariant, toolIcon } from './healthUtils.js'
import { useAppState } from '../../context/AppStateContext.jsx'

const WSL_INSTALL_COMMAND = 'wsl --install'
const WSL_SET_VERSION_COMMAND = 'wsl --set-default-version 2'
const WSL_SETUP_GUIDE_URL = 'https://learn.microsoft.com/en-us/windows/wsl/install'

/**
 * @param {{
 *   check: object
 *   checking?: boolean
 *   onRefresh?: () => void
 *   onOpenUrl?: (url: string) => void
 * }} props
 */
export default function WslHealthCard({ check, checking = false, onRefresh, onOpenUrl }) {
  const { status: systemStatus } = useAppState()
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(null)

  const wslDetails = check.wslDetails ?? systemStatus?.wslDetails ?? null
  const pathExamples = systemStatus?.pathExamples ?? null
  const dockerHints = systemStatus?.dockerWslDiagnostics?.hints ?? []

  const statusLabel = statusDisplayLabel(check.status, checking)
  const statusVariant = statusDisplayVariant(check.status, checking)

  async function copyText(text, key) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      // ignore
    }
  }

  const showSetupHelp = check.status === 'missing' || check.status === 'needs_setup'

  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border border-border bg-card/80 p-4 shadow-card',
        checking && 'border-accent/20'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background-elevated text-xl"
          aria-hidden
        >
          {toolIcon('wsl')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-medium text-white">WSL</h3>
            <StatusBadge label="Status" value={statusLabel} variant={statusVariant} pulse={checking} />
          </div>
          {check.version ? (
            <p className="mt-2 text-xs text-muted">
              Version <span className="font-mono text-gray-300">{check.version}</span>
            </p>
          ) : null}
          {check.message ? <p className="mt-1 text-xs text-muted">{check.message}</p> : null}
        </div>
      </div>

      {wslDetails?.isWindowsHost ? (
        <dl className="mt-3 grid gap-2 rounded-lg border border-border/80 bg-background/60 p-3 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-dim">WSL installed</dt>
            <dd className="font-medium text-gray-200">{wslDetails.installed ? 'Yes' : 'No'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-dim">WSL 2</dt>
            <dd className="font-medium text-gray-200">{wslDetails.wsl2Available ? 'Available' : 'Not confirmed'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-dim">Default distro</dt>
            <dd className="font-mono text-gray-200">{wslDetails.defaultDistro ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-dim">Docker WSL integration</dt>
            <dd className="font-medium text-gray-200">{wslDetails.dockerWslIntegration ?? 'unknown'}</dd>
          </div>
          {systemStatus?.dockerKvm?.wslDockerKvm ? (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-dim">WSL /dev/kvm</dt>
              <dd className="font-medium text-gray-200">
                {systemStatus.dockerKvm.wslDockerKvm.wslKvmHost ? 'Available' : 'Missing'}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-dim">
        On Windows Docker Desktop, KVM-based desktop containers may not be available depending on
        WSL2/Hyper-V/nested virtualization support. WSL is a helper for Linux container workflows — Docker
        remains the main lab runtime.
      </p>

      {showSetupHelp ? (
        <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
          <p className="font-medium text-warning">WSL setup (Administrator PowerShell)</p>
          <p className="mt-2 font-mono text-[11px] text-gray-200">{WSL_INSTALL_COMMAND}</p>
          <p className="mt-2 text-muted">After reboot:</p>
          <p className="mt-1 font-mono text-[11px] text-gray-200">{WSL_SET_VERSION_COMMAND}</p>
          <p className="mt-2 text-muted-dim">These commands are not run automatically by the app.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenUrl?.(WSL_SETUP_GUIDE_URL)}>
              Open WSL setup guide
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void copyText(WSL_INSTALL_COMMAND, 'install')}>
              {copied === 'install' ? 'Copied' : 'Copy setup command'}
            </Button>
            {onRefresh ? (
              <Button variant="secondary" size="sm" onClick={onRefresh} disabled={checking}>
                Recheck WSL
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {onRefresh ? (
            <Button variant="secondary" size="sm" onClick={onRefresh} disabled={checking}>
              Recheck WSL
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => onOpenUrl?.(WSL_SETUP_GUIDE_URL)}>
            WSL documentation
          </Button>
        </div>
      )}

      {pathExamples?.wslPath ? (
        <div className="mt-3 rounded-lg border border-border/80 bg-background/60 p-2.5 text-[11px]">
          <p className="font-medium text-muted-dim">Path example (help only)</p>
          <p className="mt-1 font-mono text-gray-300">{pathExamples.windowsPath}</p>
          <p className="mt-1 font-mono text-gray-300">→ {pathExamples.wslPath}</p>
        </div>
      ) : null}

      {dockerHints.length > 0 ? (
        <div className="mt-3 space-y-1 text-[11px] text-muted">
          <p className="font-medium text-muted-dim">Docker + WSL notes</p>
          {dockerHints.map((hint) => (
            <p key={hint}>• {hint}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-3">
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Hide distros' : 'Show distributions'}
        </Button>
      </div>

      {expanded && wslDetails?.distros?.length ? (
        <ul className="mt-2 space-y-1 font-mono text-[10px] text-muted">
          {wslDetails.distros.map((d) => (
            <li key={d.name}>
              {d.default ? '* ' : '  '}
              {d.name} — {d.state} — WSL {d.version ?? '?'}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState } from 'react'
import { Button, StatusBadge } from '../ui/index.js'
import { cn } from '../../utils/cn.js'
import { statusDisplayLabel, statusDisplayVariant, toolIcon } from './healthUtils.js'

/**
 * @param {{
 *   check: object
 *   checking?: boolean
 *   onRefresh?: () => void
 *   onOpenUrl?: (url: string) => void
 * }} props
 */
export default function ToolHealthCard({ check, checking = false, onRefresh, onOpenUrl }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const label = check.name ?? check.id
  const statusLabel = statusDisplayLabel(check.status, checking)
  const statusVariant = statusDisplayVariant(check.status, checking)
  const path = check.executablePath?.trim()

  async function copyPath() {
    if (!path) return
    try {
      await navigator.clipboard.writeText(path)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <article
      className={cn(
        'group flex flex-col rounded-xl border border-border bg-card/80 p-4 shadow-card',
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/25 hover:bg-card-hover hover:shadow-glow',
        checking && 'border-accent/20'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background-elevated text-xl',
            'transition-transform duration-200 group-hover:scale-105'
          )}
          aria-hidden="true"
        >
          {toolIcon(check.id)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-medium text-white">{label}</h3>
            <StatusBadge label="Status" value={statusLabel} variant={statusVariant} pulse={checking} />
          </div>

          {check.version ? (
            <p className="mt-2 text-xs text-muted">
              Version{' '}
              <span className="font-mono text-gray-300">{check.version}</span>
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-dim">Version not detected</p>
          )}
        </div>
      </div>

      {checking ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-accent" role="status">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          Running read-only detection…
        </div>
      ) : null}

      {path ? (
        <div className="mt-3 rounded-lg border border-border/80 bg-background/60 p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-dim">Executable</p>
          <div className="mt-1 flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-gray-300">
              {path}
            </code>
            <Button variant="ghost" size="sm" className="shrink-0 px-2" onClick={copyPath}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-dim">No executable path on record</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Hide details' : 'Details'}
        </Button>
        {onRefresh ? (
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={checking}>
            Refresh
          </Button>
        ) : null}
        {check.installUrl && onOpenUrl ? (
          <Button variant="ghost" size="sm" onClick={() => onOpenUrl(check.installUrl)}>
            Help
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2 rounded-lg border border-border-muted bg-background-elevated/40 p-3 text-sm animate-fade-in">
          {check.message ? <p className="text-muted">{check.message}</p> : null}
          {check.category ? (
            <p className="text-xs text-muted-dim">
              Category: <span className="text-gray-400">{check.category}</span>
            </p>
          ) : null}
          <p className="text-xs text-muted-dim">
            Tool id: <span className="font-mono text-gray-400">{check.id}</span>
          </p>
          {check.installUrl ? (
            <p className="break-all text-xs text-muted-dim">
              Docs:{' '}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => onOpenUrl?.(check.installUrl)}
              >
                {check.installUrl}
              </button>
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

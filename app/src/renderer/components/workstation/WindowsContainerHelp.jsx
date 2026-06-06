/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState } from 'react'
import { Button } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { cn } from '../../utils/cn.js'

const DEFAULT_SETUP_URL =
  'https://learn.microsoft.com/virtualization/windowscontainers/quick-start/set-up-environment'

/**
 * @param {{
 *   setupUrl?: string
 *   className?: string
 *   compact?: boolean
 * }} props
 */
export default function WindowsContainerHelp({ setupUrl = DEFAULT_SETUP_URL, className, compact = false }) {
  const [open, setOpen] = useState(false)

  async function openInstructions() {
    const api = getApi()
    await api?.app?.openExternal?.(setupUrl)
  }

  return (
    <div className={cn('rounded-lg border border-border/80 bg-background-elevated/30', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-gray-200 hover:bg-accent/5"
        aria-expanded={open}
      >
        <span>What are Windows container workstations?</span>
        <span className="text-muted-dim" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border px-3 py-3 text-xs text-muted">
          <p className="text-gray-200">
            Windows container workstations are <strong className="font-medium">terminal-based Windows Server containers</strong>{' '}
            using PowerShell. They are <strong className="font-medium">not</strong> full Windows desktop environments or
            VirtualBox VMs.
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Requires Docker Desktop on Windows 10 or Windows 11</li>
            <li>Docker must be switched to <span className="text-gray-200">Windows containers</span> mode</li>
            <li>Not available on macOS or Linux hosts</li>
            <li>Linux container workstations are recommended and work on all supported platforms</li>
          </ul>
          {!compact ? (
            <p className="text-[11px] text-muted-dim">
              Switching container mode in Docker Desktop restarts Docker. The app will not change this setting for you.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="border-t border-border px-3 py-2">
        <Button variant="secondary" size="sm" onClick={() => void openInstructions()}>
          Open Docker Desktop instructions
        </Button>
      </div>
    </div>
  )
}

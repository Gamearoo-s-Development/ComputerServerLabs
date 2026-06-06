/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { getApi } from '../hooks/useApi.js'
import { Button, Card, SectionTitle, StatusBadge } from '../components/ui/index.js'
import { cn } from '../utils/cn.js'
import { COMMAND_CATALOG, COMMAND_CATEGORIES, isBlockedCommand } from '../constants/commandGuide.js'
import { GAME_UI } from '../constants/gameTone.js'

function warningTone(level) {
  switch (level) {
    case 'blocked':
      return 'danger'
    case 'risky':
      return 'warning'
    case 'caution':
      return 'neutral'
    default:
      return 'neutral'
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function CommandGuide() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    const api = getApi()
    void api?.discord?.updatePresence?.({ page: 'command-guide' })
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return COMMAND_CATALOG.filter((e) => {
      if (category !== 'all' && e.category !== category) return false
      if (!q) return true
      const hay = `${e.command} ${e.explanation} ${e.example}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, category])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-fade-in">
      <SectionTitle
        title={GAME_UI.commandCodex}
        description="Commands that may or may not help in a lab. Picking the right tool is part of the challenge."
      />

      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr,14rem]">
          <label className="block">
            <span className="text-xs uppercase text-muted-dim">Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands, flags, concepts…"
              className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase text-muted-dim">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm text-white"
            >
              <option value="all">All</option>
              {COMMAND_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted">
          Safety note: commands here are intended for lab containers and basic troubleshooting. Destructive host commands are not suggested.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((e) => {
          const blocked = isBlockedCommand(e.command) || e.warningLevel === 'blocked'
          const wl = blocked ? 'blocked' : (e.warningLevel ?? 'none')
          return (
            <Card key={e.key} className={cn(blocked && 'border-danger/35')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-white break-words">{e.command}</p>
                  <p className="mt-1 text-xs text-muted">{e.explanation}</p>
                </div>
                <StatusBadge label="Level" value={e.difficulty} variant="neutral" />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge label="Category" value={e.category} variant="accent" />
                <StatusBadge label="Safety" value={wl} variant={warningTone(wl)} />
                {e.mayHelp ? <StatusBadge label="Tag" value="May help in some labs" variant="neutral" /> : null}
              </div>

              <div className="mt-3 rounded-lg border border-border bg-background-elevated/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-dim">Example</p>
                <code className="mt-1 block font-mono text-xs text-gray-200 break-words">{e.example}</code>
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  variant={blocked ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => void copy(e.command)}
                  title={blocked ? 'This looks destructive. Only run commands you understand.' : 'Copy to clipboard'}
                >
                  Copy
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}


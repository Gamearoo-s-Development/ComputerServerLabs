/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ToolHealthCard from '../components/health/ToolHealthCard.jsx'
import WslHealthCard from '../components/health/WslHealthCard.jsx'
import { groupToolChecks, TOOL_IDS } from '../components/health/healthUtils.js'
import WhySafeSection from '../components/safety/WhySafeSection.jsx'
import { useAppState } from '../context/AppStateContext.jsx'
import { Button, Card, SectionTitle, Skeleton } from '../components/ui/index.js'
import { getApi } from '../hooks/useApi.js'
import { GAME_UI } from '../constants/gameTone.js'

export default function Tools() {
  const { status, applyStatus } = useAppState()
  const [scanningAll, setScanningAll] = useState(false)
  const [checkingIds, setCheckingIds] = useState(() => new Set())
  const [lastChecked, setLastChecked] = useState(null)

  const grouped = useMemo(() => groupToolChecks(status?.healthChecks ?? []), [status?.healthChecks])

  useEffect(() => {
    if (status?.collectedAt) {
      setLastChecked(status.collectedAt)
    }
  }, [status?.collectedAt])

  useEffect(() => {
    const api = getApi()
    void api?.discord?.updatePresence?.({ page: 'tools' })
  }, [])

  const openUrl = useCallback(async (url) => {
    const api = getApi()
    if (api?.app?.openExternal) {
      await api.app.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener')
    }
  }, [])

  const applyToolsResult = useCallback(
    (data) => {
      if (data) {
        applyStatus(data)
        setLastChecked(data.collectedAt ?? new Date().toISOString())
      }
    },
    [applyStatus]
  )

  const refreshAll = useCallback(async () => {
    const api = getApi()
    if (!api?.tools?.refreshStatus) return

    setScanningAll(true)
    setCheckingIds(new Set(TOOL_IDS))

    try {
      const result = await api.tools.refreshStatus()
      if (result.ok) {
        applyToolsResult(result.data)
      }
    } finally {
      setCheckingIds(new Set())
      setScanningAll(false)
    }
  }, [applyToolsResult])

  const refreshOne = useCallback(
    async (toolId) => {
      const api = getApi()
      if (!api?.tools?.refreshTool) return

      setCheckingIds((prev) => new Set(prev).add(toolId))
      try {
        const result = await api.tools.refreshTool(toolId)
        if (result.ok) {
          applyToolsResult(result.data)
        }
      } finally {
        setCheckingIds((prev) => {
          const next = new Set(prev)
          next.delete(toolId)
          return next
        })
      }
    },
    [applyToolsResult]
  )

  const isChecking = (id) => scanningAll || checkingIds.has(id)
  const showSkeleton = scanningAll && grouped.length === 0

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col justify-center py-2">
      <SectionTitle
        eyebrow="Diagnostics"
        title={GAME_UI.systemScan}
        description="Read-only scans grouped by category. Per-tool refresh — nothing runs in the background."
        action={
          <Button variant="secondary" size="sm" onClick={refreshAll} disabled={scanningAll}>
            {scanningAll ? 'Scanning…' : 'Refresh all'}
          </Button>
        }
      />

      {lastChecked ? (
        <p className="mb-4 text-xs text-muted-dim">
          Last checked: {new Date(lastChecked).toLocaleString()}
        </p>
      ) : null}

      {showSkeleton ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((category) => (
            <section key={category.id}>
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-white">{category.title}</h2>
                <p className="text-xs text-muted">{category.description}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {category.tools.map((check) =>
                  check.id === 'wsl' ? (
                    <WslHealthCard
                      key={check.id}
                      check={check}
                      checking={isChecking(check.id)}
                      onRefresh={() => refreshOne(check.id)}
                      onOpenUrl={openUrl}
                    />
                  ) : (
                    <ToolHealthCard
                      key={check.id}
                      check={check}
                      checking={isChecking(check.id)}
                      onRefresh={() => refreshOne(check.id)}
                      onOpenUrl={openUrl}
                    />
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {scanningAll ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-accent" role="status">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          Running full diagnostics…
        </p>
      ) : null}

      <WhySafeSection />

      <Card className="mt-6 border-warning/20">
        <p className="text-sm font-medium text-white">Troubleshooting</p>
        <p className="mt-2 text-sm text-muted">
          If Docker shows as needs setup, launch Docker Desktop and wait until the engine is running. On Windows,
          install WSL 2 when using Docker Desktop.
        </p>
        <Button className="mt-4" variant="primary" size="sm" onClick={() => openUrl('https://docs.docker.com/get-docker/')}>
          Docker install guide
        </Button>
      </Card>
    </div>
  )
}

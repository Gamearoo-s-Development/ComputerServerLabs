/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Button, StatusBadge } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { GAME_UI } from '../../constants/gameTone.js'
import { cn } from '../../utils/cn.js'

/**
 * @param {{ status?: string, httpStatus?: number | null }} route
 */
function statusVariant(route) {
  if (route.status === 'online') return 'success'
  if (route.status === 'starting') return 'warning'
  return 'muted'
}

/**
 * @param {{ status?: string, httpStatus?: number | null }} route
 */
function statusLabel(route) {
  if (route.status === 'online') {
    return route.httpStatus
      ? `${GAME_UI.serviceStatusOnline} (HTTP ${route.httpStatus})`
      : GAME_UI.serviceStatusOnline
  }
  if (route.status === 'starting') return GAME_UI.serviceStatusStarting
  return GAME_UI.serviceStatusOffline
}

/**
 * @param {{ sessionId: string, routes?: object[], onRoutesUpdated?: (routes: object[]) => void }} props
 */
export default function LabServiceRoutes({ sessionId, routes = [], onRoutesUpdated }) {
  const { notify } = useNotifications()
  const [refreshing, setRefreshing] = useState(false)
  const [localRoutes, setLocalRoutes] = useState(routes)

  useEffect(() => {
    setLocalRoutes(routes)
  }, [routes])

  const refresh = useCallback(async () => {
    const api = getApi()
    if (!api?.labs?.refreshServiceRoutes || !sessionId) return
    setRefreshing(true)
    try {
      const res = await api.labs.refreshServiceRoutes(sessionId)
      if (res?.ok) {
        const next = res.data?.serviceRoutes ?? []
        setLocalRoutes(next)
        onRoutesUpdated?.(next)
      } else {
        notify({
          title: 'Could not refresh services',
          body: res?.error?.message ?? 'Unknown error',
          tone: 'warning'
        })
      }
    } finally {
      setRefreshing(false)
    }
  }, [sessionId, notify, onRoutesUpdated])

  const visible = (localRoutes ?? []).filter((r) => r?.showToUser !== false)

  if (visible.length === 0) return null

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text)
      notify({ title: 'Copied', body: `${label} copied to clipboard.`, tone: 'info' })
    } catch {
      notify({ title: 'Copy failed', body: `Could not copy ${label}.`, tone: 'warning' })
    }
  }

  return (
    <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
          {GAME_UI.availableLabServices}
        </h3>
        <Button variant="ghost" size="sm" disabled={refreshing} onClick={() => void refresh()}>
          {refreshing ? 'Refreshing…' : GAME_UI.serviceRouteRefresh}
        </Button>
      </div>
      <ul className="mt-3 space-y-3">
        {visible.map((route) => (
          <li
            key={`${route.purpose}-${route.containerPort}-${route.hostPort}`}
            className="rounded-md border border-border/60 bg-background/30 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-200">{route.label}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-dim">{route.purpose}</p>
              </div>
              <StatusBadge variant={statusVariant(route)} label="Status" value={statusLabel(route)} />
            </div>
            {route.accessLabel || route.url ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <code className="break-all font-mono text-[11px] text-accent">
                  {route.accessLabel ?? route.url}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void copyText(route.accessLabel ?? route.url, route.label)}
                >
                  Copy
                </Button>
              </div>
            ) : null}
            {route.hint ? <p className={cn('mt-2 text-[11px] text-muted-dim')}>{route.hint}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

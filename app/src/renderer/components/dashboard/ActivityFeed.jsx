/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import Card from '../ui/Card.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import { cn } from '../../utils/cn.js'

const TONE_DOT = {
  info: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger'
}

const DEMO_ACTIVITY = [
  { type: 'quiz', message: 'Quiz completed — Linux permissions basics', tone: 'success' },
  { type: 'hint', message: 'Hints unlocked in NGINX repair lab', tone: 'info' },
  { type: 'vm', message: 'VM started (VirtualBox) — placeholder event', tone: 'info' },
  { type: 'container', message: 'Container failed: port 2222 already allocated', tone: 'danger' }
]

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '--:--'
  }
}

export default function ActivityFeed() {
  const { loading, profile } = useAppState()
  const activity = profile?.activity?.length ? profile.activity : DEMO_ACTIVITY.map((item, i) => ({
    ...item,
    id: `demo-${i}`,
    at: new Date(Date.now() - i * 600000).toISOString()
  }))

  return (
    <Card className="h-full">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Recent activity</h3>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {activity.map((item) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-lg border border-border/60 bg-background-elevated/50 px-3 py-2 transition-colors hover:border-border"
            >
              <span
                className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE_DOT[item.tone] ?? TONE_DOT.info)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-200">{item.message}</p>
                <p className="mt-0.5 text-xs text-muted-dim">{formatTime(item.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

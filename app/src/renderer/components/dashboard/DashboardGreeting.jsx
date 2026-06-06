/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import XpBar from '../progress/XpBar.jsx'
import { Skeleton } from '../ui/index.js'

export default function DashboardGreeting() {
  const { loading, profile, rank, xpMeta } = useAppState()

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-48" />
      </div>
    )
  }

  const name = profile?.username || 'User'
  const streak = profile?.streak ?? 0
  const rankTitle = rank?.title ?? 'User'

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <p className="text-sm text-muted">
          Welcome back, <span className="font-semibold text-white">{name}</span>.
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
          Level {profile?.level ?? 1}{' '}
          <span className="bg-gradient-to-r from-accent to-success bg-clip-text text-transparent">
            {rankTitle}
          </span>
        </h2>
      </div>
      <XpBar
        compact
        xp={profile?.xp ?? 0}
        level={profile?.level ?? 1}
        currentLevelXp={xpMeta?.currentLevelXp ?? 0}
        nextLevelXp={xpMeta?.nextLevelXp ?? 200}
        progressPct={xpMeta?.progressPct ?? 0}
        rankTitle={rankTitle}
        className="max-w-md"
      />
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="rounded-md border border-border bg-background-elevated px-2.5 py-1 text-muted">
          Streak <span className="text-warning">{streak}</span> days
        </span>
      </div>
    </div>
  )
}

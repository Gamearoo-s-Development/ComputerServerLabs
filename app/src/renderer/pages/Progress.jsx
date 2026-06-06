/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../context/AppStateContext.jsx'
import AchievementCard from '../components/progress/AchievementCard.jsx'
import XpBar from '../components/progress/XpBar.jsx'
import { Card, SectionTitle, Skeleton } from '../components/ui/index.js'
import { getApi } from '../hooks/useApi.js'
import { GAME_UI } from '../constants/gameTone.js'

function formatDuration(sec) {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function Progress() {
  const { loading, profile, rank, xpMeta, stats, refresh } = useAppState()
  const [achievements, setAchievements] = useState([])

  useEffect(() => {
    const api = getApi()
    api?.discord?.updatePresence?.({ page: 'progress' })
    api?.progress?.getAchievements?.().then((result) => {
      if (result?.ok) setAchievements(result.data?.achievements ?? [])
    })
  }, [])

  useEffect(() => {
    if (profile?.achievements?.length) {
      setAchievements((current) => {
        if (current.length) return current
        return profile.achievements
      })
    }
  }, [profile?.achievements])

  const unlockedCount = useMemo(
    () => achievements.filter((a) => a.unlocked).length,
    [achievements]
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-48" />
      </div>
    )
  }

  const completedLabs = stats?.completedLabs ?? []
  const activity = profile?.activity ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionTitle
        eyebrow="Gamification"
        title={GAME_UI.playerProgress}
        description="XP, rank, and lab stats stored locally on this device."
      />

      <Card padding="md" className="border-accent/20">
        <XpBar
          xp={profile?.xp ?? 0}
          level={profile?.level ?? 1}
          currentLevelXp={xpMeta?.currentLevelXp ?? 0}
          nextLevelXp={xpMeta?.nextLevelXp ?? 200}
          progressPct={xpMeta?.progressPct ?? 0}
          rankTitle={rank?.title}
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card padding="md">
          <p className="text-xs uppercase tracking-wide text-muted">Total XP</p>
          <p className="mt-1 text-3xl font-bold text-white">{profile?.xp ?? 0}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wide text-muted">Level</p>
          <p className="mt-1 text-3xl font-bold text-accent">{profile?.level ?? 1}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wide text-muted">Labs completed</p>
          <p className="mt-1 text-3xl font-bold text-white">{stats?.totalCompleted ?? 0}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wide text-muted">Achievements</p>
          <p className="mt-1 text-3xl font-bold text-white">
            {unlockedCount}
            <span className="text-lg text-muted"> / {achievements.length || stats?.achievementsTotal || 5}</span>
          </p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-white">Best completion times</h3>
          {completedLabs.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Complete a lab to record your best times.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {completedLabs.slice(0, 8).map((lab) => (
                <li
                  key={lab.labId}
                  className="flex items-center justify-between rounded-lg border border-border bg-background-elevated/50 px-3 py-2 text-sm"
                >
                  <span className="text-gray-200">{lab.labId}</span>
                  <span className="text-accent">{formatDuration(lab.bestTimeSec)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-white">Recent activity</h3>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Activity from labs and achievements appears here.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {activity.slice(0, 8).map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-border bg-background-elevated/50 px-3 py-2 text-sm text-gray-300"
                >
                  {item.message}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">XP over time</h3>
          <span className="text-xs text-muted">Chart placeholder — Phase 9 polish</span>
        </div>
        <div className="mt-4 flex h-36 items-end gap-2 rounded-lg border border-dashed border-border bg-background-elevated/40 px-4 pb-4 pt-8">
          {[35, 48, 42, 60, 55, 72, 68].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-accent/20 transition-all duration-500"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Achievement progress</h3>
          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={() => refresh({ force: true })}
          >
            Refresh
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.slice(0, 6).map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} compact />
          ))}
        </div>
      </div>
    </div>
  )
}

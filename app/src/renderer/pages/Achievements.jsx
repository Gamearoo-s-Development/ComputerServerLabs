/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useMemo, useState } from 'react'
import AchievementCard from '../components/progress/AchievementCard.jsx'
import { Card, SectionTitle, Skeleton, StatusBadge } from '../components/ui/index.js'
import { getApi } from '../hooks/useApi.js'

export default function Achievements() {
  const [loading, setLoading] = useState(true)
  const [achievements, setAchievements] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const api = getApi()
    api?.discord?.updatePresence?.({ page: 'achievements' })

    async function load() {
      const result = await api?.progress?.getAchievements?.()
      if (result?.ok) {
        setAchievements(result.data?.achievements ?? [])
      }
      setLoading(false)
    }

    load()
  }, [])

  const unlocked = useMemo(() => achievements.filter((a) => a.unlocked), [achievements])
  const locked = useMemo(() => achievements.filter((a) => !a.unlocked), [achievements])

  const visible = filter === 'unlocked' ? unlocked : filter === 'locked' ? locked : achievements

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionTitle
        eyebrow="Badges"
        title="Achievements"
        description="Unlock milestones by completing labs, validating objectives, and keeping Docker ready."
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge variant="success" label="Unlocked" value={String(unlocked.length)} />
        <StatusBadge variant="neutral" label="Locked" value={String(locked.length)} />
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'unlocked', label: 'Unlocked' },
            { id: 'locked', label: 'Locked' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={
                filter === item.id
                  ? 'rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent'
                  : 'rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:bg-card'
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Card padding="md">
          <p className="text-sm text-muted">No achievements match this filter yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
      )}
    </div>
  )
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import XpBar from '../progress/XpBar.jsx'
import { Button, Card } from '../ui/index.js'
import { GAME_UI } from '../../constants/gameTone.js'

/**
 * @param {{ onNavigate: (id: string) => void }} props
 */
export default function ProgressionOverview({ onNavigate }) {
  const { profile, rank, xpMeta, progression } = useAppState()
  const counts = progression?.counts
  const recommended = progression?.recommendedNext ?? []
  const nextUnlock = progression?.nextUnlockPreview ?? []

  return (
    <Card className="border-accent/15">
      <h3 className="text-sm font-semibold text-white">{GAME_UI.missionProgression}</h3>
      <p className="mt-1 text-xs text-muted">
        Complete labs to earn XP, level up, and unlock harder scenarios.
      </p>

      <div className="mt-4">
        <XpBar
          xp={profile?.xp ?? 0}
          level={profile?.level ?? 1}
          currentLevelXp={xpMeta?.currentLevelXp ?? 0}
          nextLevelXp={xpMeta?.nextLevelXp ?? 200}
          progressPct={xpMeta?.progressPct ?? 0}
          rankTitle={rank?.title}
          compact
        />
        {xpMeta?.xpToNextLevel != null && xpMeta.xpToNextLevel > 0 ? (
          <p className="mt-2 text-xs text-muted-dim">
            <span className="font-medium text-accent">{xpMeta.xpToNextLevel} XP</span> until level{' '}
            {(profile?.level ?? 1) + 1}
          </p>
        ) : null}
      </div>

      {counts ? (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-md bg-background-elevated/50 px-2 py-1.5">
            <dt className="text-muted-dim">Available</dt>
            <dd className="font-semibold text-success">{counts.available}</dd>
          </div>
          <div className="rounded-md bg-background-elevated/50 px-2 py-1.5">
            <dt className="text-muted-dim">Locked</dt>
            <dd className="font-semibold text-warning">{counts.locked}</dd>
          </div>
          <div className="rounded-md bg-background-elevated/50 px-2 py-1.5">
            <dt className="text-muted-dim">In progress</dt>
            <dd className="font-semibold text-gray-200">{counts.inProgress}</dd>
          </div>
          <div className="rounded-md bg-background-elevated/50 px-2 py-1.5">
            <dt className="text-muted-dim">Completed</dt>
            <dd className="font-semibold text-accent">{counts.completed}</dd>
          </div>
        </dl>
      ) : null}

      {recommended.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-dim">Recommended next</p>
          <ul className="mt-2 space-y-1.5">
            {recommended.map((lab) => (
              <li
                key={lab.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
              >
                <span className="truncate text-gray-200">{lab.title}</span>
                <span className="shrink-0 text-accent">{lab.xpReward ?? 0} XP</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {nextUnlock.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-dim">Coming up</p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted">
            {nextUnlock.map((lab) => (
              <li key={lab.id} className="rounded-md border border-border/40 bg-background/30 px-2 py-1.5">
                <span className="font-medium text-gray-300">🔒 {lab.title}</span>
                {lab.minUnlockLevel ? (
                  <span className="mt-0.5 block text-muted-dim">Unlocks at Level {lab.minUnlockLevel}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button className="mt-4" variant="secondary" size="sm" onClick={() => onNavigate('labs')}>
        {GAME_UI.openMissionBrowser}
      </Button>
    </Card>
  )
}

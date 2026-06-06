/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { leaderboardInitials, xpProgressWithinLevel } from '../lib/leaderboardProgress.js'

/**
 * @param {{ entry: Record<string, unknown>, highlight?: boolean }} props
 */
export default function LeaderboardProfileCard({ entry, highlight = false }) {
  const rank = Number(entry.rank ?? 0)
  const name = String(entry.displayName ?? entry.display_name ?? 'Learner')
  const xp = Number(entry.xp ?? 0)
  const level = Number(entry.level ?? 1)
  const completedLabs = Number(entry.completedLabs ?? entry.completed_labs ?? 0)
  const achievementCount = Number(entry.achievementCount ?? entry.achievement_count ?? 0)
  const hintsUsed = Number(entry.hintsUsed ?? entry.hints_used ?? 0)
  const { percent, floor, ceiling } = xpProgressWithinLevel(xp, level)

  const topRing =
    rank === 1
      ? 'ring-amber-400/40'
      : rank === 2
        ? 'ring-slate-300/30'
        : rank === 3
          ? 'ring-orange-400/30'
          : 'ring-border/60'

  return (
    <article
      className={`grid grid-cols-[auto_auto_1fr] gap-3 rounded-lg border border-border/80 bg-background/40 p-3 ${topRing} ring-1 ${highlight ? 'ring-sky-400/50' : ''}`}
    >
      <div className="pt-1 text-center text-sm font-bold text-muted-dim w-6" aria-hidden="true">
        {rank <= 3 ? (
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs ${
              rank === 1 ? 'bg-amber-500/20 text-amber-200' : rank === 2 ? 'bg-slate-400/20 text-slate-200' : 'bg-orange-500/20 text-orange-200'
            }`}
          >
            {rank}
          </span>
        ) : (
          rank
        )}
      </div>
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/50 to-sky-500/40 text-xs font-bold text-white"
        aria-hidden="true"
      >
        {leaderboardInitials(name)}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-100">{name}</h3>
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-300/90">Level {level}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background-elevated/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          <span className="font-semibold text-gray-200">{xp.toLocaleString()} XP</span>
          <span className="text-muted-dim">
            {' '}
            · {floor.toLocaleString()}–{ceiling.toLocaleString()} to next level
          </span>
        </p>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div>
            <dt className="text-muted-dim uppercase tracking-wide">Labs</dt>
            <dd className="font-semibold text-gray-200">{completedLabs}</dd>
          </div>
          <div>
            <dt className="text-muted-dim uppercase tracking-wide">Achievements</dt>
            <dd className="font-semibold text-gray-200">{achievementCount}</dd>
          </div>
          <div>
            <dt className="text-muted-dim uppercase tracking-wide">Hints</dt>
            <dd className="font-semibold text-gray-200">{hintsUsed}</dd>
          </div>
        </dl>
      </div>
    </article>
  )
}

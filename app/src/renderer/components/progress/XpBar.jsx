/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { cn } from '../../utils/cn.js'

/**
 * @param {{
 *   xp: number
 *   level: number
 *   currentLevelXp?: number
 *   nextLevelXp?: number
 *   progressPct?: number
 *   rankTitle?: string
 *   compact?: boolean
 *   className?: string
 * }} props
 */
export default function XpBar({
  xp = 0,
  level = 1,
  currentLevelXp = 0,
  nextLevelXp = 200,
  progressPct = 0,
  rankTitle,
  compact = false,
  className
}) {
  const pct = Math.min(100, Math.max(0, progressPct))

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 font-semibold text-accent">
            Lv {level}
          </span>
          {rankTitle ? <span className="text-muted">{rankTitle}</span> : null}
        </div>
        {!compact ? (
          <span className="text-muted">
            <span className="font-medium text-white">{xp}</span> XP
            {nextLevelXp > currentLevelXp ? (
              <span>
                {' '}
                · {Math.max(0, nextLevelXp - xp)} to next level
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted">{xp} XP</span>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background-elevated ring-1 ring-border">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Level ${level} progress`}
        />
      </div>
    </div>
  )
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { cn } from '../../utils/cn.js'

/**
 * @param {{
 *   achievement: { id: string, title: string, description: string, icon: string, unlocked: boolean, unlockedAt?: string | null }
 *   compact?: boolean
 * }} props
 */
export default function AchievementCard({ achievement, compact = false }) {
  const locked = !achievement.unlocked

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl border p-4 transition-all duration-300',
        locked
          ? 'border-border bg-card/40 opacity-70 grayscale'
          : 'border-accent/25 bg-card shadow-card hover:border-accent/40'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl',
            locked ? 'bg-background-elevated' : 'bg-accent/10 ring-1 ring-accent/20'
          )}
          aria-hidden="true"
        >
          {achievement.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white">{achievement.title}</h3>
          {!compact ? (
            <p className="mt-1 text-sm text-muted">{achievement.description}</p>
          ) : null}
          {achievement.unlocked && achievement.unlockedAt ? (
            <p className="mt-2 text-xs text-success">
              Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-dim">Locked</p>
          )}
        </div>
      </div>
    </article>
  )
}

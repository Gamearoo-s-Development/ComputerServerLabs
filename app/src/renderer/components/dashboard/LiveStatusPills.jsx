/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import Skeleton from '../ui/Skeleton.jsx'

export default function LiveStatusPills({ compact = false }) {
  const { loading, pills, refresh } = useAppState()

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: compact ? 3 : 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28" />
        ))}
      </div>
    )
  }

  const visible = compact ? pills.slice(0, 3) : pills

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((pill) => (
        <StatusBadge
          key={pill.label}
          label={pill.label}
          value={pill.value}
          variant={pill.variant}
          title={pill.detail}
          className="transition-transform duration-200 hover:scale-[1.02]"
        />
      ))}
      <button
        type="button"
        onClick={() => refresh()}
        className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
      >
        Refresh
      </button>
    </div>
  )
}

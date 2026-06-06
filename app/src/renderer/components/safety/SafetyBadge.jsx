/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import { cn } from '../../utils/cn.js'

/**
 * @param {{ className?: string, compact?: boolean }} props
 */
export default function SafetyBadge({ className, compact = false }) {
  const { profile } = useAppState()
  const enabled = profile?.settings?.safetyModeEnabled !== false

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
        enabled
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-warning/30 bg-warning/10 text-warning',
        className
      )}
      title={enabled ? 'Safety Mode protects host boundaries' : 'Safety Mode is disabled'}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', enabled ? 'bg-success' : 'bg-warning')} />
      {compact ? (enabled ? 'Safe' : 'Off') : enabled ? 'Safety Mode' : 'Safety Off'}
    </span>
  )
}

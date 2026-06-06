/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { cn } from '../../utils/cn.js'

/**
 * @param {{
 *   label: string
 *   value: string
 *   variant?: 'unknown' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral' | 'checking'
 *   pulse?: boolean
 *   className?: string
 * }} props
 */
export default function StatusBadge({ label, value, variant = 'neutral', pulse = false, className }) {
  const dotClass = {
    unknown: 'bg-muted-dim',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    accent: 'bg-accent',
    checking: 'bg-accent',
    neutral: 'bg-muted'
  }[variant]

  const textClass = {
    unknown: 'text-muted',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    accent: 'text-accent',
    checking: 'text-accent',
    neutral: 'text-gray-300'
  }[variant]

  const shouldPulse = pulse || variant === 'checking'

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-background-elevated/80',
        'px-3 py-1.5 text-xs backdrop-blur-sm',
        variant === 'checking' && 'border-accent/30',
        className
      )}
      title={`${label}: ${value}`}
    >
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', dotClass, shouldPulse && 'animate-pulse')}
        aria-hidden="true"
      />
      <span className="text-muted">{label}:</span>
      <span className={cn('font-medium', textClass)}>{value}</span>
    </div>
  )
}

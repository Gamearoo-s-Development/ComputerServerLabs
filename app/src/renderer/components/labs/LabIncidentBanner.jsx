/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { cn } from '../../utils/cn.js'

/**
 * @param {{ ticket?: object, incident?: object, className?: string }} props
 */
export default function LabIncidentBanner({ ticket, incident, className }) {
  if (!ticket?.id && !ticket?.summary) return null

  const severity = incident?.severity ?? ticket?.priority ?? 'medium'
  const critical = severity === 'critical'
  const showBanner = critical || incident?.outageBanner === true

  if (!showBanner) {
    return (
      <div className={cn('rounded-lg border border-border/80 bg-background-elevated/50 px-3 py-2', className)}>
        <p className="text-xs text-muted-dim">
          <span className="font-mono text-accent">{ticket.id}</span>
          {' · '}
          {ticket.summary}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        critical
          ? 'animate-pulse border-danger/50 bg-danger/10 text-danger'
          : 'border-warning/40 bg-warning/10 text-warning',
        className
      )}
    >
      <p className="font-semibold">
        {critical ? 'CRITICAL INCIDENT' : 'OUTAGE'} — {ticket.id}
      </p>
      <p className="mt-1 text-xs opacity-90">{ticket.summary}</p>
    </div>
  )
}

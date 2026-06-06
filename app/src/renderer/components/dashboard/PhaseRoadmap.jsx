/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { PHASE_ROADMAP } from '../../constants/dashboard.js'
import Card from '../ui/Card.jsx'
import { cn } from '../../utils/cn.js'

export default function PhaseRoadmap() {
  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Lab roadmap</h3>
      <ol className="space-y-3">
        {PHASE_ROADMAP.map((item) => (
          <li
            key={item.phase}
            className={cn(
              'flex gap-3 rounded-lg border px-3 py-2 transition-colors',
              item.status === 'active'
                ? 'border-accent/30 bg-accent/5'
                : 'border-border bg-background-elevated/40'
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                item.status === 'active' ? 'bg-accent/20 text-accent' : 'bg-card text-muted'
              )}
            >
              {item.phase}
            </span>
            <div>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="text-xs text-muted">{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

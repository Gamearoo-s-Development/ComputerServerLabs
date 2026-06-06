/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { LAB_CATEGORIES } from '../../constants/dashboard.js'
import { useAppState } from '../../context/AppStateContext.jsx'
import Card from '../ui/Card.jsx'
import { cn } from '../../utils/cn.js'

export default function LabCategoryGrid({ onNavigate }) {
  const { status } = useAppState()
  const labCount = status?.labs?.count ?? 0

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Lab categories</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {LAB_CATEGORIES.map((cat) => (
          <Card
            key={cat.id}
            hover
            padding="sm"
            className="group cursor-pointer transition-all duration-200 hover:shadow-glow"
            onClick={() => onNavigate('labs')}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={cn('text-sm font-semibold text-white', cat.accent)}>{cat.title}</p>
                <p className="mt-1 text-xs text-muted">{cat.description}</p>
              </div>
              <span className="rounded-md bg-background-elevated px-2 py-0.5 text-[10px] uppercase text-muted">
                P{cat.phase}
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-dim">
              {labCount > 0 ? `${labCount} labs on disk` : 'Locked until labs ship'}
            </p>
          </Card>
        ))}
      </div>
    </div>
  )
}

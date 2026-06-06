/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { Button } from '../ui/index.js'
import { cn } from '../../utils/cn.js'
import { LAB_BUILDER_WIZARD_STEPS } from './labBuilderWizardSteps.js'

/**
 * @param {{
 *   step: string
 *   onStepChange: (id: string) => void
 *   onPrev?: () => void
 *   onNext?: () => void
 *   canNext?: boolean
 * }} props
 */
export default function LabBuilderWizardNav({ step, onStepChange, onPrev, onNext, canNext = true }) {
  const idx = LAB_BUILDER_WIZARD_STEPS.findIndex((s) => s.id === step)
  const current = LAB_BUILDER_WIZARD_STEPS[idx] ?? LAB_BUILDER_WIZARD_STEPS[0]

  return (
    <div className="space-y-3 border-b border-border pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
            Step {idx + 1} of {LAB_BUILDER_WIZARD_STEPS.length}
          </p>
          <p className="text-sm font-medium text-gray-200">{current.label}</p>
          <p className="text-xs text-muted">{current.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" type="button" disabled={idx <= 0} onClick={onPrev}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" type="button" disabled={!canNext || idx >= LAB_BUILDER_WIZARD_STEPS.length - 1} onClick={onNext}>
            Next
          </Button>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {LAB_BUILDER_WIZARD_STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            title={s.label}
            onClick={() => onStepChange(s.id)}
            className={cn(
              'shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
              step === s.id ? 'bg-accent/25 text-accent' : 'text-muted hover:bg-card hover:text-gray-200',
              i < idx && 'text-success/80'
            )}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

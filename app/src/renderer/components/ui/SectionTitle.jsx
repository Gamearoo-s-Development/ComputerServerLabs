/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { cn } from '../../utils/cn.js'

/**
 * @param {{
 *   eyebrow?: string
 *   title: string
 *   description?: string
 *   className?: string
 *   action?: React.ReactNode
 * }} props
 */
export default function SectionTitle({ eyebrow, title, description, className, action }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">{eyebrow}</p>
        ) : null}
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

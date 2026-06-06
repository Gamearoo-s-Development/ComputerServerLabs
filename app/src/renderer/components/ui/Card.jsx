/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { cn } from '../../utils/cn.js'

/**
 * @param {{
 *   children: React.ReactNode
 *   className?: string
 *   padding?: 'none' | 'sm' | 'md' | 'lg'
 *   hover?: boolean
 *   onClick?: () => void
 * }} props
 */
export default function Card({ children, className, padding = 'md', hover = false, onClick }) {
  const paddingClass = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  }[padding]

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        'rounded-xl border border-border bg-card/90 shadow-card backdrop-blur-sm',
        paddingClass,
        hover && 'transition-all duration-200 hover:border-border-muted hover:bg-card-hover',
        onClick && 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent/50',
        className
      )}
    >
      {children}
    </div>
  )
}

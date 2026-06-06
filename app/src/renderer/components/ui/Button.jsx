/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { cn } from '../../utils/cn.js'

/**
 * @param {React.ButtonHTMLAttributes<HTMLButtonElement> & {
 *   variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
 *   size?: 'sm' | 'md' | 'lg'
 * }} props
 */
export default function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  disabled,
  type = 'button',
  ...rest
}) {
  const variantClass = {
    primary:
      'bg-accent/15 text-accent border-accent/30 hover:bg-accent/25 hover:border-accent/50',
    secondary:
      'bg-background-elevated text-gray-200 border-border hover:bg-card hover:border-border-muted',
    ghost: 'bg-transparent text-muted border-transparent hover:bg-card/60 hover:text-gray-200',
    danger:
      'bg-danger/10 text-danger border-danger/30 hover:bg-danger/20 hover:border-danger/50'
  }[variant]

  const sizeClass = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base'
  }[size]

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium',
        'transition-colors duration-150 focus-visible:outline focus-visible:outline-2',
        'focus-visible:outline-offset-2 focus-visible:outline-accent/60',
        'disabled:cursor-not-allowed disabled:opacity-45',
        variantClass,
        sizeClass,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

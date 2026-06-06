/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import { cn } from '../utils/cn.js'

export default function AnimatedBackground() {
  const reducedMotion = useReducedMotion()

  return (
    <div className={cn('app-backdrop', reducedMotion && 'app-backdrop--static')} aria-hidden="true">
      <div className="app-backdrop__grid" />
      <div
        className={cn(
          'app-backdrop__glow app-backdrop__glow--cyan',
          !reducedMotion && 'animate-glow-drift'
        )}
      />
      <div
        className={cn(
          'app-backdrop__glow app-backdrop__glow--green',
          !reducedMotion && 'animate-glow-drift'
        )}
      />
      <div className="app-backdrop__scanline" />
    </div>
  )
}

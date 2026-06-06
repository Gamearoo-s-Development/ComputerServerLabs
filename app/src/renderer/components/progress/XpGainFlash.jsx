/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { cn } from '../../utils/cn.js'

/**
 * @param {{ amount: number, className?: string }} props
 */
export default function XpGainFlash({ amount, className }) {
  if (!amount || amount <= 0) return null

  return (
    <p
      className={cn(
        'animate-xp-pop text-sm font-semibold text-success',
        className
      )}
      role="status"
    >
      +{amount} XP
    </p>
  )
}

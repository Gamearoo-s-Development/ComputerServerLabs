/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react'
import { useAppState } from '../context/AppStateContext.jsx'

export function useReducedMotion() {
  const { profile } = useAppState()
  const [systemPref, setSystemPref] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setSystemPref(mq.matches)
    const handler = (e) => setSystemPref(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const userPref = profile?.settings?.reducedAnimations === true
  return userPref || systemPref
}

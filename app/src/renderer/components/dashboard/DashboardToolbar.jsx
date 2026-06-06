/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useState } from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import { getApi } from '../../hooks/useApi.js'
import { useAmbientAudio } from '../../hooks/useAmbientAudio.js'
import Button from '../ui/Button.jsx'

export default function DashboardToolbar() {
  const { profile } = useAppState()
  const [ambient, setAmbient] = useState(profile?.settings?.ambientAudio ?? false)
  const [fullscreen, setFullscreen] = useState(false)
  useAmbientAudio(ambient)

  useEffect(() => {
    setAmbient(profile?.settings?.ambientAudio ?? false)
  }, [profile?.settings?.ambientAudio])

  async function toggleFullscreen() {
    const api = getApi()
    if (!api?.app?.toggleFullscreen) return
    const result = await api.app.toggleFullscreen()
    if (result?.ok) {
      setFullscreen(result.data.fullscreen)
    }
  }

  async function toggleAmbient() {
    const next = !ambient
    setAmbient(next)
    const api = getApi()
    await api?.settings?.set?.({ ambientAudio: next })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={ambient ? 'primary' : 'ghost'} size="sm" onClick={toggleAmbient}>
        Ambient {ambient ? 'On' : 'Off'}
      </Button>
      <Button variant={fullscreen ? 'primary' : 'ghost'} size="sm" onClick={toggleFullscreen}>
        {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      </Button>
    </div>
  )
}

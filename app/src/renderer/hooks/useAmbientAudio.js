/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** Low-volume synthetic datacenter ambience via Web Audio (no asset files). */
export function useAmbientAudio(enabled) {
  const ctxRef = useRef(null)
  const nodesRef = useRef(null)
  const [active, setActive] = useState(false)

  const stop = useCallback(() => {
    nodesRef.current?.gain?.gain.setTargetAtTime(0, ctxRef.current?.currentTime ?? 0, 0.15)
    setTimeout(() => {
      nodesRef.current?.osc?.stop()
      nodesRef.current?.noise?.stop()
      ctxRef.current?.close()
      ctxRef.current = null
      nodesRef.current = null
      setActive(false)
    }, 200)
  }, [])

  const start = useCallback(async () => {
    if (active) return
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    const gain = ctx.createGain()
    gain.gain.value = 0.04

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 58

    const bufferSize = 2 * ctx.sampleRate
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.15
    }
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer
    noise.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 320

    osc.connect(filter)
    noise.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    noise.start()
    ctxRef.current = ctx
    nodesRef.current = { osc, noise, gain }
    setActive(true)
  }, [active])

  useEffect(() => {
    if (enabled) {
      start()
    } else {
      stop()
    }
    return () => stop()
  }, [enabled, start, stop])

  return { active }
}

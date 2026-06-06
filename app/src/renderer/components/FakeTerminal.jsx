/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import {
  generateFakeScenario,
  randomDelay,
  randomTypingSpeed
} from '../utils/fakeTerminalGenerator.js'
import { cn } from '../utils/cn.js'

export { generateFakeScenario, randomDelay, randomTypingSpeed } from '../utils/fakeTerminalGenerator.js'

/** @typedef {{ id: string, type: string, text: string, partial?: boolean }} DisplayLine */

const LINE_CLASS = {
  cmd: 'text-accent',
  out: 'text-gray-400',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
  log: 'text-muted'
}

const MAX_LINES_DEFAULT = 16

/**
 * Fictional terminal ambience — no host/Docker/shell access.
 *
 * @param {{
 *   className?: string
 *   title?: string
 *   maxLines?: number
 *   subtle?: boolean
 *   embedded?: boolean
 *   autoStart?: boolean
 * }} props
 */
export default function FakeTerminal({
  className,
  title = 'lab terminal — bash',
  maxLines = MAX_LINES_DEFAULT,
  subtle = true,
  embedded = false,
  autoStart = true
}) {
  const [lines, setLines] = useState(/** @type {DisplayLine[]} */ ([
    { id: 'boot', type: 'log', text: '[sim] lab terminal — fictional output only' }
  ]))
  const [cursorOn, setCursorOn] = useState(true)
  const phaseRef = useRef('pause')
  const scenarioRef = useRef(null)
  const lineIndexRef = useRef(0)
  const charIndexRef = useRef(0)
  const activeLineIdRef = useRef(null)
  const scrollRef = useRef(null)
  const mountedRef = useRef(true)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const blink = setInterval(() => setCursorOn((v) => !v), 530)
    return () => clearInterval(blink)
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  useEffect(() => {
    if (!autoStart) return undefined

    if (reducedMotion) {
      const scenario = generateFakeScenario()
      setLines([
        { id: 'boot', type: 'log', text: '[sim] lab terminal — fictional output only' },
        { id: 'cmd', type: 'cmd', text: `$ ${scenario.command}` },
        ...scenario.lines.map((line, i) => ({ id: `out-${i}`, type: line.type, text: line.text }))
      ])
      return undefined
    }

    /** @type {ReturnType<typeof setTimeout>[]} */
    const timeouts = []

    const schedule = (fn, ms) => {
      const id = setTimeout(() => {
        if (mountedRef.current) fn()
      }, ms)
      timeouts.push(id)
    }

    const startScenario = () => {
      scenarioRef.current = generateFakeScenario()
      lineIndexRef.current = -1
      charIndexRef.current = 0
      phaseRef.current = 'typing-cmd'
      const cmdLine = {
        id: `cmd-${Date.now()}`,
        type: 'cmd',
        text: '',
        partial: true
      }
      activeLineIdRef.current = cmdLine.id
      setLines((prev) => [...prev, cmdLine].slice(-maxLines))
      schedule(tick, randomTypingSpeed(28, 48))
    }

    const tick = () => {
      const scenario = scenarioRef.current
      if (!scenario) {
        schedule(startScenario, randomDelay(600, 1400))
        return
      }

      if (phaseRef.current === 'typing-cmd') {
        const full = `$ ${scenario.command}`
        charIndexRef.current += 1
        const partial = full.slice(0, charIndexRef.current)
        setLines((prev) =>
          prev.map((line) =>
            line.id === activeLineIdRef.current ? { ...line, text: partial, type: 'cmd' } : line
          )
        )
        if (charIndexRef.current < full.length) {
          schedule(tick, randomTypingSpeed(22, 42))
          return
        }
        setLines((prev) =>
          prev.map((line) =>
            line.id === activeLineIdRef.current ? { ...line, text: full, partial: false } : line
          )
        )
        lineIndexRef.current = 0
        charIndexRef.current = 0
        phaseRef.current = 'printing-output'
        schedule(tick, randomDelay(120, 320))
        return
      }

      if (phaseRef.current === 'printing-output') {
        const outLines = scenario.lines
        if (lineIndexRef.current >= outLines.length) {
          scenarioRef.current = null
          phaseRef.current = 'pause'
          activeLineIdRef.current = null
          schedule(startScenario, randomDelay(900, 2800))
          return
        }

        const src = outLines[lineIndexRef.current]
        const full = src.text
        if (charIndexRef.current === 0) {
          const id = `out-${Date.now()}-${lineIndexRef.current}`
          activeLineIdRef.current = id
          setLines((prev) =>
            [...prev, { id, type: src.type, text: '', partial: true }].slice(-maxLines)
          )
        }

        charIndexRef.current += Math.random() > 0.7 ? 2 : 1
        const partial = full.slice(0, charIndexRef.current)
        setLines((prev) =>
          prev.map((line) =>
            line.id === activeLineIdRef.current ? { ...line, text: partial, type: src.type } : line
          )
        )

        if (charIndexRef.current < full.length) {
          schedule(tick, randomTypingSpeed(6, 16))
          return
        }

        setLines((prev) =>
          prev.map((line) =>
            line.id === activeLineIdRef.current ? { ...line, text: full, partial: false } : line
          )
        )
        lineIndexRef.current += 1
        charIndexRef.current = 0
        activeLineIdRef.current = null
        schedule(tick, randomDelay(40, 180))
        return
      }

      schedule(startScenario, randomDelay(600, 1200))
    }

    schedule(startScenario, randomDelay(400, 900))

    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [autoStart, maxLines, reducedMotion])

  const shell = (
    <>
      <div className="flex items-center gap-2 border-b border-border bg-background-elevated/80 px-4 py-2">
        <span className="h-2 w-2 rounded-full bg-danger/70" />
        <span className="h-2 w-2 rounded-full bg-warning/70" />
        <span className="h-2 w-2 rounded-full bg-success/70" />
        <span className="ml-2 text-xs text-muted">{title}</span>
      </div>
      <pre
        ref={scrollRef}
        className="max-h-52 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed sm:max-h-60 sm:text-xs"
      >
        {lines.map((line) => (
          <div key={line.id} className={cn(LINE_CLASS[line.type] ?? LINE_CLASS.out)}>
            {line.text}
          </div>
        ))}
        <span
          className={cn(
            'ml-0.5 inline-block h-3.5 w-1.5 align-middle',
            cursorOn ? 'bg-accent/70' : 'bg-transparent'
          )}
          aria-hidden="true"
        />
      </pre>
    </>
  )

  if (embedded) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border/60 bg-background/40',
          subtle && 'opacity-60',
          className
        )}
      >
        {shell}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-accent/15 bg-card/50 shadow-card backdrop-blur-sm',
        subtle && 'opacity-80',
        className
      )}
    >
      {shell}
    </div>
  )
}

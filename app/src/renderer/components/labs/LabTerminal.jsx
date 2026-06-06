/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import '../../styles/lab-terminal.css'
import { Button } from '../ui/index.js'
import { GAME_UI } from '../../constants/gameTone.js'
import { getApi } from '../../hooks/useApi.js'
import { readClipboardText, writeClipboardText } from '../../utils/clipboard.js'
import { cn } from '../../utils/cn.js'
import { normalizeWorkstationLoginMode } from '@sysadmin-game/shared/workstations/workstationLoginMode.js'

function terminalBannerStorageKey(sessionId) {
  return `sgq-lab-terminal-intro-${sessionId}`
}

function hasSeenTerminalIntro(sessionId) {
  try {
    return sessionStorage.getItem(terminalBannerStorageKey(sessionId)) === '1'
  } catch {
    return false
  }
}

function markTerminalIntroSeen(sessionId) {
  try {
    sessionStorage.setItem(terminalBannerStorageKey(sessionId), '1')
  } catch {
    // ignore quota / private mode
  }
}

/** Send clipboard text into the PTY (normalized newlines). */
async function pasteIntoTerminal(api, terminalId, text) {
  if (!text || !terminalId || !api?.terminal?.write) return
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  await api.terminal.write(terminalId, normalized)
}

const TERM_THEME = {
  background: '#0a0c10',
  foreground: '#e4e4e7',
  cursor: '#22d3ee',
  cursorAccent: '#0a0c10',
  selectionBackground: '#164e63',
  black: '#18181b',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa'
}

function buildStartupBanner(session, options = {}) {
  const showDebug = options.showDebug === true
  const discoverMode = session?.accessMode === 'discover'
  const credentials = session?.credentials ?? {}
  const workstationCredentials = session?.workstationCredentials ?? {}
  const username = discoverMode
    ? null
    : workstationCredentials.username ?? credentials.username ?? 'user'
  const password = discoverMode
    ? null
    : workstationCredentials.password ?? credentials.password ?? '(unavailable)'
  const targetUsername = credentials.username ?? username

  const rule = '=================================================='
  const cyan = '\x1b[1;36m'
  const reset = '\x1b[0m'
  const dim = '\x1b[2m'
  const yellow = '\x1b[33m'

  const isVmWorkstation =
    session?.helper?.workstationRuntime === 'vm' ||
    session?.selectedWorkstation?.runtime === 'vm' ||
    Boolean(session?.helper?.vmId)

  const workstationName =
    session?.helper?.workstationProfileName ??
    session?.selectedWorkstation?.name ??
    'Lab Workstation'
  const workstationDistro = session?.helper?.workstationDistro ?? 'Linux'

  const loginMode = normalizeWorkstationLoginMode(session?.workstationCredentials?.loginMode)
  const ttyLogin = loginMode === 'tty-login'

  let body =
    `\r\n${cyan}${rule}${reset}\r\n` +
    `${cyan} ${GAME_UI.terminalBannerTitle}${reset}\r\n` +
    `${cyan}${rule}${reset}\r\n\r\n` +
    `${cyan}${workstationName}${reset}\r\n`

  if (isVmWorkstation) {
    body +=
      `${dim}VirtualBox VM workstation · ${workstationDistro}${reset}\r\n\r\n` +
      `${dim}${GAME_UI.terminalBannerIsolation}${reset}\r\n` +
      `${dim}Use Open VM Window in the mission panel to complete OS setup in VirtualBox.${reset}\r\n\r\n`
    if (!discoverMode) {
      body +=
        `${cyan}${GAME_UI.terminalAccessCodes}${reset}\r\n` +
        `${GAME_UI.username}: ${yellow}${username}${reset}\r\n` +
        `${GAME_UI.password}: ${yellow}${password}${reset}\r\n`
    } else {
      body +=
        `${yellow}${GAME_UI.discoverModeNote}${reset}\r\n` +
        `${dim}${GAME_UI.discoverModeSshHint}${reset}\r\n`
    }
    if (session?.helper?.vmId) {
      body += `${dim}VM name: ${session.helper.vmId}${reset}\r\n`
    }
    return body + '\r\n'
  }

  body +=
    `${dim}Connected to isolated lab environment · ${workstationDistro}${reset}\r\n\r\n` +
    `${dim}${GAME_UI.terminalBannerIsolation}${reset}\r\n` +
    `${dim}${GAME_UI.labWorkstationBlurb}${reset}\r\n\r\n`

  if (discoverMode) {
    body +=
      `${yellow}${GAME_UI.discoverModeNote}${reset}\r\n` +
      `${dim}${GAME_UI.discoverModeSshHint}${reset}\r\n\r\n`
  } else {
    body +=
      `${cyan}${GAME_UI.terminalAccessCodes}${reset}\r\n` +
      `${GAME_UI.username}: ${yellow}${username}${reset}\r\n` +
      `${GAME_UI.password}: ${yellow}${password}${reset}\r\n` +
      `${dim}${GAME_UI.labSudoNote}${reset}\r\n`
    if (ttyLogin) {
      body +=
        `\r\n${dim}Sign in at the workstation login prompt below (hostname: lab-workstation).${reset}\r\n`
    }
  }

  if (showDebug && session?.connection?.host) {
    body +=
      `${GAME_UI.host}: ${yellow}${session.connection.host}${reset}\r\n` +
      `${GAME_UI.port}: ${yellow}${session.connection.port ?? 22}${reset}\r\n`
    body += `\r\n${dim}Debug mode: lab target is on the private Docker session network only.${reset}\r\n`
  }

  const targetHost =
    session?.connection?.host ??
    session?.credentials?.targetInternalIp ??
    session?.helper?.targetInternalIp ??
    null
  const sshCommand =
    session?.connection?.command ??
    (targetHost && targetUsername ? `ssh ${targetUsername}@${targetHost}` : null)

  body += `\r\n${dim}${GAME_UI.terminalPanelClue}${reset}\r\n`
  if (sshCommand) {
    body += `${dim}  ${sshCommand}${reset}\r\n`
  } else if (targetUsername) {
    body += `${dim}  ssh ${targetUsername}@<lab-target-ip>${reset}\r\n`
  }
  body += `${dim}${GAME_UI.terminalConnectHint}${reset}\r\n`
  return body + '\r\n'
}

/**
 * Dedicated lab terminal window (xterm.js + PTY in main process).
 * @param {{ sessionId: string, standalone?: boolean }} props
 */
export default function LabTerminal({ sessionId, standalone = false }) {
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState(null)
  const [reconnectKey, setReconnectKey] = useState(0)

  const hostRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const terminalIdRef = useRef(null)
  const bannerShownRef = useRef(false)
  const pendingDataRef = useRef([])

  const flushPending = useCallback(() => {
    const term = termRef.current
    if (!term) return
    for (const chunk of pendingDataRef.current) {
      term.write(chunk)
    }
    pendingDataRef.current = []
  }, [])

  const writeBannerOnce = useCallback(
    (session, options) => {
      if (bannerShownRef.current || !termRef.current) return
      if (hasSeenTerminalIntro(sessionId)) {
        bannerShownRef.current = true
        flushPending()
        return
      }
      bannerShownRef.current = true
      markTerminalIntroSeen(sessionId)
      termRef.current.write(buildStartupBanner(session, options))
      flushPending()
      termRef.current.focus()
    },
    [flushPending, sessionId]
  )

  const handleClear = useCallback(() => {
    termRef.current?.clear()
    termRef.current?.focus()
  }, [])

  const handleReconnect = useCallback(() => {
    const api = getApi()
    const id = terminalIdRef.current
    if (id) {
      void api?.terminal?.detach?.(id)
      terminalIdRef.current = null
    }
    bannerShownRef.current = false
    pendingDataRef.current = []
    setError(null)
    setStatus('connecting')
    setReconnectKey((k) => k + 1)
  }, [])

  const handlePasteFromClipboard = useCallback(async () => {
    const api = getApi()
    const id = terminalIdRef.current
    if (!id) return
    try {
      const text = await readClipboardText()
      await pasteIntoTerminal(api, id, text)
      termRef.current?.focus()
    } catch {
      setError('Clipboard paste is not available. Use Ctrl+Shift+V or type manually.')
    }
  }, [])

  const handleCopySelection = useCallback(async () => {
    const term = termRef.current
    if (!term) return
    const selection = term.getSelection()
    if (!selection) {
      setError('Select text in the terminal first, then copy.')
      return
    }
    try {
      await writeClipboardText(selection)
      setError(null)
      term.focus()
    } catch {
      setError('Clipboard copy is not available. Use Ctrl+Shift+C after selecting text.')
    }
  }, [])

  const copySelectionRef = useRef(handleCopySelection)
  copySelectionRef.current = handleCopySelection

  useEffect(() => {
    const api = getApi()
    const hostEl = hostRef.current
    if (!api?.terminal?.attach || !sessionId || !hostEl) return undefined

    let cancelled = false
    bannerShownRef.current = false
    pendingDataRef.current = []
    terminalIdRef.current = null
    setStatus('connecting')
    setError(null)

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: TERM_THEME
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.open(hostEl)
    fitAddon.fit()
    termRef.current = term
    fitRef.current = fitAddon

    const resizeObserver = new ResizeObserver(() => {
      if (cancelled) return
      try {
        fitAddon.fit()
        const id = terminalIdRef.current
        if (id && api.terminal?.resize && term.cols && term.rows) {
          void api.terminal.resize(id, term.cols, term.rows)
        }
      } catch {
        // ignore during teardown
      }
    })
    resizeObserver.observe(hostEl)

    const writeToTerm = (chunk) => {
      if (!bannerShownRef.current) {
        pendingDataRef.current.push(chunk)
        return
      }
      term.write(chunk)
    }

    const detachData = api.terminal.onData?.((payload) => {
      if (cancelled) return
      if (payload?.terminalId && payload.terminalId === terminalIdRef.current) {
        writeToTerm(payload.data ?? '')
      }
    })

    const detachExit = api.terminal.onExit?.((payload) => {
      if (payload?.terminalId !== terminalIdRef.current) return
      terminalIdRef.current = null
      setStatus('disconnected')
      writeToTerm('\r\n\x1b[33m[session ended — use Reconnect]\x1b[0m\r\n')
    })

    const dataDisposable = term.onData((data) => {
      const id = terminalIdRef.current
      if (!id || !api.terminal?.write) return
      void api.terminal.write(id, data)
    })

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown' || event.altKey) return true
      const key = event.key.toLowerCase()
      const isPaste =
        ((event.ctrlKey || event.metaKey) && key === 'v') || (event.shiftKey && key === 'insert')
      const isCopy = (event.ctrlKey || event.metaKey) && event.shiftKey && key === 'c'
      if (isCopy) {
        event.preventDefault()
        void copySelectionRef.current()
        return false
      }
      if (!isPaste) return true
      event.preventDefault()
      void (async () => {
        try {
          const text = await readClipboardText()
          await pasteIntoTerminal(api, terminalIdRef.current, text)
        } catch {
          // clipboard unavailable in this context
        }
      })()
      return false
    })

    const onPaste = (event) => {
      event.preventDefault()
      const text = event.clipboardData?.getData('text/plain') ?? ''
      void pasteIntoTerminal(api, terminalIdRef.current, text)
    }
    hostEl.addEventListener('paste', onPaste)

    const connect = async () => {
      try {
        const sessionRes = await api.labs?.getSessionState?.(sessionId)
        if (cancelled) return

        const attachRes = await api.terminal.attach(sessionId, { cols: term.cols, rows: term.rows })
        if (cancelled) return
        if (!attachRes?.ok) {
          setError(attachRes?.error?.message ?? 'Failed to attach terminal')
          setStatus('error')
          return
        }

        terminalIdRef.current = attachRes.data.terminalId
        setStatus('ready')

        if (sessionRes?.ok) {
          const showDebug = sessionRes.data?.showLabDebugInfo === true
          writeBannerOnce(sessionRes.data, { showDebug })
        } else {
          writeBannerOnce({ credentials: { username: 'user', password: '' }, ports: [] }, { showDebug: false })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Terminal attach failed')
          setStatus('error')
        }
      }
    }

    void connect()

    return () => {
      cancelled = true
      dataDisposable.dispose()
      hostEl.removeEventListener('paste', onPaste)
      detachData?.()
      detachExit?.()
      resizeObserver.disconnect()
      const id = terminalIdRef.current
      if (id) {
        void api.terminal?.detach?.(id)
        terminalIdRef.current = null
      }
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [sessionId, reconnectKey, writeBannerOnce])

  return (
    <div className={cn('lab-terminal-root flex h-full min-h-0 flex-col', standalone && 'standalone')}>
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-background-elevated/80 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-dim">{GAME_UI.missionTerminal}</span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] uppercase tracking-wide',
              status === 'ready' ? 'text-success' : status === 'error' ? 'text-danger' : 'text-muted'
            )}
          >
            {status}
          </span>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void handleCopySelection()}>
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void handlePasteFromClipboard()}>
            Paste
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReconnect}>
            Reconnect
          </Button>
        </div>
      </header>
      {error ? <p className="shrink-0 border-b border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
      <p className="shrink-0 border-b border-border/60 px-3 py-1 text-[10px] text-muted-dim">
        Select text, then Copy or Ctrl+Shift+C · Paste or Ctrl+Shift+V
      </p>
      <div ref={hostRef} className="min-h-0 flex-1" />
    </div>
  )
}


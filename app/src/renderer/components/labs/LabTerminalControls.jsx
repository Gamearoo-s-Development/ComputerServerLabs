/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import { Button } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { devLog } from '../../utils/devLog.js'
import { GAME_UI } from '../../constants/gameTone.js'

const OPEN_TIMEOUT_MS = 20000

/**
 * Lab session terminal launcher — opens a separate Electron window (no inline xterm).
 * @param {{ sessionId: string, helper?: object, hideDirectSshCommand?: boolean, embedded?: boolean, onRegisterOpen?: (openFn: () => Promise<void>) => void }} props
 */
export default function LabTerminalControls({
  sessionId,
  helper,
  hideDirectSshCommand: _hideDirectSshCommand,
  embedded = false,
  onRegisterOpen
}) {
  const { notify } = useNotifications()
  const { profile, isDevelopmentUnpackaged } = useAppState()
  const developerMode = profile?.settings?.developerMode === true
  const [status, setStatus] = useState({ windowOpen: false, attached: false, terminalId: null })
  const [opening, setOpening] = useState(false)
  const [lastError, setLastError] = useState(null)
  const [debugLog, setDebugLog] = useState('')
  const [ptyAvailable, setPtyAvailable] = useState(null)

  const refreshStatus = useCallback(async () => {
    const api = getApi()
    if (!api?.terminal?.getStatus || !sessionId) return
    const res = await api.terminal.getStatus(sessionId)
    if (res?.ok) {
      setStatus({
        windowOpen: Boolean(res.data?.windowOpen),
        attached: Boolean(res.data?.attached),
        terminalId: res.data?.terminalId ?? null
      })
    }
  }, [sessionId])

  const loadDebugLog = useCallback(async () => {
    const api = getApi()
    if (!api?.terminal?.getDebugLog || !sessionId) return
    const res = await api.terminal.getDebugLog(sessionId)
    if (res?.ok) {
      setDebugLog(res.data?.log ?? '')
    }
  }, [sessionId])

  useEffect(() => {
    const api = getApi()
    if (!api?.terminal?.checkPty) return
    void api.terminal.checkPty().then((res) => {
      if (res?.ok) setPtyAvailable(res.data?.available === true)
    })
  }, [])

  useEffect(() => {
    void refreshStatus()
    const timer = setInterval(() => void refreshStatus(), 2000)
    return () => clearInterval(timer)
  }, [refreshStatus])

  const handleOpen = useCallback(async () => {
    const api = getApi()
    const openFn = api?.labTerminal?.open ?? api?.terminal?.openWindow

    devLog('terminal', 'Open Lab Terminal button clicked', { sessionId })

    if (!openFn) {
      const msg = 'Terminal API is not available. Restart the app.'
      setLastError(msg)
      notify({ title: 'Terminal unavailable', body: msg, tone: 'danger' })
      return
    }

    if (!sessionId) {
      const msg = 'No active lab session.'
      setLastError(msg)
      notify({ title: 'Terminal unavailable', body: msg, tone: 'danger' })
      return
    }

    setOpening(true)
    setLastError(null)

    try {
      devLog('terminal', 'IPC open request sent', { sessionId })
      const res = await Promise.race([
        openFn(sessionId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timed out while opening the lab terminal window.')), OPEN_TIMEOUT_MS)
        )
      ])
      if (!res?.ok) {
        const msg = res?.error?.message ?? 'Could not open lab terminal window.'
        const log = res?.error?.debugLog ?? ''
        setLastError(msg)
        if (log) setDebugLog(log)
        notify({
          title: 'Lab terminal unavailable',
          body: msg,
          tone: 'danger'
        })
        return
      }
      if (res.data?.debugLog) setDebugLog(res.data.debugLog)
      setStatus((prev) => ({ ...prev, windowOpen: true }))
      setLastError(null)
      await refreshStatus()
      await loadDebugLog()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not open lab terminal window.'
      setLastError(msg)
      notify({
        title: 'Could not start sandbox terminal.',
        body: msg,
        tone: 'danger'
      })
    } finally {
      setOpening(false)
    }
  }, [sessionId, notify, refreshStatus, loadDebugLog])

  useEffect(() => {
    onRegisterOpen?.(handleOpen)
  }, [handleOpen, onRegisterOpen])

  const handleCopyDebug = useCallback(async () => {
    const api = getApi()
    let text = debugLog
    if (api?.terminal?.getDebugLog) {
      const res = await api.terminal.getDebugLog(sessionId)
      if (res?.ok) {
        text = res.data?.log ?? text
        setDebugLog(text)
      }
    }
    try {
      await navigator.clipboard.writeText(text || 'No debug log available.')
      notify({ title: 'Copied', body: 'Terminal debug log copied to clipboard.', tone: 'info' })
    } catch {
      notify({ title: 'Copy failed', body: 'Could not copy debug log.', tone: 'warning' })
    }
  }, [debugLog, sessionId, notify])

  const isVmWorkstation =
    helper?.workstationRuntime === 'vm' || Boolean(helper?.vmId)
  const vmReady = isVmWorkstation && Boolean(helper?.vmId)

  const statusLabel = isVmWorkstation
    ? vmReady
      ? 'VM workstation ready'
      : 'VM provisioning…'
    : status.windowOpen
      ? status.attached
        ? 'Workstation ready'
        : 'Window open'
      : 'Not open'

  const actionLabel = opening
    ? 'Opening...'
    : isVmWorkstation
      ? vmReady
        ? 'Reopen VM Window'
        : 'Open VM Window'
      : status.windowOpen
        ? 'Reopen Lab Terminal'
        : GAME_UI.openMissionTerminal

  const accessModes = helper?.workstationAccessModes ?? ['terminal']
  const canOpenDockerTerminal = !isVmWorkstation && accessModes.includes('terminal')
  const canOpenVmWindow = isVmWorkstation

  const body = (
    <>
      {!embedded ? (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
            {isVmWorkstation ? 'VM workstation' : GAME_UI.missionTerminal}
          </h3>
          <p className="mt-2 text-xs text-muted">
            {isVmWorkstation
              ? 'Opens the VirtualBox window for your selected VM workstation (installation and desktop).'
              : GAME_UI.useMissionTerminal}
          </p>
          {!isVmWorkstation ? (
            <p className="mt-1 text-[11px] text-muted-dim">{GAME_UI.labWorkstationBlurb}</p>
          ) : null}
        </>
      ) : null}

      {ptyAvailable === false && canOpenDockerTerminal ? (
        <p className="mt-2 rounded-md border border-danger/30 bg-danger/10 px-2 py-1.5 text-xs text-danger">
          node-pty is not loaded. On Windows install Visual Studio C++ Spectre libraries — see{' '}
          <code className="font-mono">docs/windows-build.md</code>, then run{' '}
          <code className="font-mono">npm run rebuild:native</code>.
        </p>
      ) : null}

      {lastError ? (
        <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <p className="text-sm font-medium text-danger">
            {isVmWorkstation ? 'Could not open VM window.' : 'Could not open lab terminal.'}
          </p>
          <p className="mt-1 text-xs text-muted">{lastError}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={opening} onClick={() => void handleOpen()}>
              Retry
            </Button>
            {(developerMode || isDevelopmentUnpackaged) && debugLog ? (
              <Button variant="ghost" size="sm" onClick={() => void handleCopyDebug()}>
                Copy debug logs
              </Button>
            ) : null}
          </div>
          {(developerMode || isDevelopmentUnpackaged) && debugLog ? (
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-background/60 p-2 font-mono text-[10px] text-muted">
              {debugLog}
            </pre>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {canOpenVmWindow ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={opening || !vmReady}
            title={vmReady ? undefined : 'Wait for VirtualBox VM provisioning to finish.'}
            onClick={() => void handleOpen()}
          >
            {actionLabel}
          </Button>
        ) : null}
        {canOpenDockerTerminal ? (
          <Button
            variant={embedded ? 'secondary' : 'secondary'}
            size="sm"
            disabled={opening || ptyAvailable === false}
            onClick={() => void handleOpen()}
          >
            {embedded && !status.windowOpen && !opening ? 'Open Terminal (direct)' : actionLabel}
          </Button>
        ) : null}
        <span className="text-[11px] text-muted">
          Status: <span className="font-medium text-gray-200">{statusLabel}</span>
        </span>
      </div>
      {!embedded ? (
        <p className="mt-2 text-[10px] text-muted-dim">
          {isVmWorkstation
            ? 'The lab target container keeps running while you work in the VM. End the lab from the session panel when finished.'
            : 'Closing the terminal ends your workstation shell only. The lab target keeps running — reopen anytime.'}
        </p>
      ) : null}
    </>
  )

  if (embedded) {
    return <div>{body}</div>
  }

  return <section className="rounded-lg border border-border bg-background-elevated/60 p-3">{body}</section>
}

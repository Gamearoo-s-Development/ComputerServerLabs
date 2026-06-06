/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { GAME_UI } from '../../constants/gameTone.js'
import LabTerminalControls from './LabTerminalControls.jsx'
import LocalTerminalControls from './LocalTerminalControls.jsx'
import WorkstationLoginSection from './WorkstationLoginSection.jsx'
import { desktopWorkstationViewerAvailable } from './desktopViewerUtils.js'

/**
 * @param {{
 *   session: object
 *   isDesktopWorkstation?: boolean
 *   isWindowsDesktopWorkstation?: boolean
 *   isHostTerminalWorkstation?: boolean
 *   isWslLocalTerminal?: boolean
 *   onSessionUpdate?: (session: object) => void
 * }} props
 */
export default function WorkstationAccessSection({
  session,
  isDesktopWorkstation = false,
  isWindowsDesktopWorkstation = false,
  isHostTerminalWorkstation = false,
  isWslLocalTerminal = false,
  onSessionUpdate
}) {
  const { notify } = useNotifications()
  const helper = session.helper ?? {}
  const workstationCredentials = session.workstationCredentials ?? null
  const [accessRoutes, setAccessRoutes] = useState(helper.workstationAccessRoutes ?? [])
  const [refreshing, setRefreshing] = useState(false)
  const [activatingDesktop, setActivatingDesktop] = useState(false)
  const terminalOpenRef = useRef(null)

  useEffect(() => {
    setAccessRoutes(helper.workstationAccessRoutes ?? [])
  }, [helper.workstationAccessRoutes, session.sessionId])

  const profileName = helper.workstationProfileName ?? 'Ubuntu Terminal Workstation'

  const refreshRoutes = useCallback(async () => {
    const api = getApi()
    if (!api?.labs?.refreshWorkstationAccessRoutes || !session.sessionId) return
    setRefreshing(true)
    try {
      const res = await api.labs.refreshWorkstationAccessRoutes(session.sessionId)
      if (res?.ok) {
        setAccessRoutes(res.data?.workstationAccessRoutes ?? [])
      } else {
        notify({
          title: 'Could not refresh routes',
          body: res?.error?.message ?? 'Unknown error',
          tone: 'warning'
        })
      }
    } finally {
      setRefreshing(false)
    }
  }, [session.sessionId, notify])

  const desktopAvailable = desktopWorkstationViewerAvailable(helper)

  const openDesktop = useCallback(async () => {
    const api = getApi()
    if (!api?.labs?.refreshWorkstationAccessRoutes || !session.sessionId) {
      notify({
        title: 'Desktop not ready',
        body: 'The desktop viewer is not available yet. Wait for the workstation to finish starting.',
        tone: 'warning'
      })
      return
    }
    try {
      const res = await api.labs.refreshWorkstationAccessRoutes(session.sessionId)
      const url = res?.data?.workstationDesktopUrl ?? null
      if (!res?.ok || !url) {
        notify({
          title: 'Desktop not ready',
          body: res?.error?.message ?? 'The desktop viewer URL is not available yet.',
          tone: 'warning'
        })
        return
      }
      if (api?.labs?.openDesktopWindow) {
        const openRes = await api.labs.openDesktopWindow({
          sessionId: session.sessionId,
          url,
          title: profileName
        })
        if (!openRes?.ok) {
          throw new Error(openRes?.error?.message ?? 'Could not open desktop window.')
        }
      } else {
        // Fallback for older builds without dedicated desktop window support
        if (api?.app?.openExternal) {
          await api.app.openExternal(url)
        } else {
          window.open(url, '_blank', 'noopener,noreferrer')
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not open the desktop viewer.'
      notify({ title: 'Open Desktop failed', body: msg, tone: 'danger' })
    }
  }, [notify, profileName, session.sessionId])

  const markDesktopReadyAndStartLab = useCallback(async () => {
    const api = getApi()
    if (!api?.labs?.enterSession || !session.sessionId) return
    setActivatingDesktop(true)
    try {
      const enterRes = await api.labs.enterSession(session.sessionId)
      if (enterRes?.ok && enterRes.data) {
        onSessionUpdate?.(enterRes.data)
        notify({
          title: 'Lab timer started',
          body: 'Desktop marked as ready. Lab session is now active.',
          tone: 'success'
        })
      } else {
        notify({
          title: 'Could not start lab',
          body: enterRes?.error?.message ?? 'Session activation failed.',
          tone: 'warning'
        })
      }
    } finally {
      setActivatingDesktop(false)
    }
  }, [notify, onSessionUpdate, session.sessionId])

  const openTerminal = useCallback(async () => {
    if (!terminalOpenRef.current) {
      notify({
        title: 'Terminal unavailable',
        body: 'The lab terminal is not ready yet.',
        tone: 'warning'
      })
      return
    }
    await terminalOpenRef.current()
  }, [notify])

  if (isHostTerminalWorkstation) {
    return (
      <div className="space-y-3">
        <WorkstationLoginSection
          workstationCredentials={workstationCredentials}
          accessMethodLabel={isWslLocalTerminal ? 'WSL Local Terminal' : 'Local Terminal'}
          terminalAvailable
          onOpenTerminal={openTerminal}
        />
        <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
            {GAME_UI.workstationAccess}
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">Type</dt>
              <dd className="mt-0.5 font-medium text-gray-200">{profileName}</dd>
            </div>
          </dl>
          <div className="mt-3">
            <LocalTerminalControls session={session} variant={isWslLocalTerminal ? 'wsl' : 'host'} embedded />
          </div>
          <p className="mt-3 text-[11px] text-muted-dim">{GAME_UI.workstationThenTargetNote}</p>
        </section>
      </div>
    )
  }

  if (isDesktopWorkstation) {
    return (
      <div className="space-y-3">
        <WorkstationLoginSection
          workstationCredentials={workstationCredentials}
          accessMethodLabel={
            isWindowsDesktopWorkstation ? 'Embedded Desktop Viewer' : 'Embedded Desktop Viewer'
          }
          desktopAvailable={desktopAvailable}
          onOpenDesktop={openDesktop}
        />

        <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
            {GAME_UI.workstationAccess}
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">Type</dt>
              <dd className="mt-0.5 font-medium text-gray-200">{profileName}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">Access</dt>
              <dd className="mt-0.5 text-xs text-muted">
                Use Open Desktop to launch the desktop viewer in a separate window.
              </dd>
            </div>
          </dl>

          {helper.workstationDesktopRuntimeLabel ? (
            <p className="mt-2 text-[11px] font-medium text-success">
              Desktop runtime: {helper.workstationDesktopRuntimeLabel}
            </p>
          ) : null}

          <p className="mt-2 text-xs text-muted">
            {isWindowsDesktopWorkstation ? GAME_UI.desktopWorkstationNote : GAME_UI.linuxDesktopWorkstationNote}
          </p>

          {!desktopAvailable ? (
            <p className="mt-2 text-[11px] text-warning">
              Desktop viewer will be available after Windows finishes starting.
            </p>
          ) : null}

          <div className="mt-3">
            <Button variant="ghost" size="sm" disabled={refreshing} onClick={() => void refreshRoutes()}>
              {refreshing ? 'Refreshing…' : 'Refresh Routes'}
            </Button>
          </div>

          {session.awaitingDesktopEnter === true ? (
            <div className="mt-3 rounded-md border border-accent/30 bg-accent/10 p-2">
              <p className="text-[11px] text-muted">
                Keep the timer paused until Windows reaches a usable desktop/login state.
              </p>
              <div className="mt-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={activatingDesktop}
                  onClick={() => void markDesktopReadyAndStartLab()}
                >
                  {activatingDesktop ? 'Starting…' : 'Desktop Ready - Start Lab'}
                </Button>
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-[11px] text-muted-dim">{GAME_UI.workstationThenTargetNote}</p>
        </section>

      </div>
    )
  }

  const isVmWorkstation = helper.workstationRuntime === 'vm' || Boolean(helper.vmId)

  return (
    <div className="space-y-3">
      {!isVmWorkstation ? (
        <WorkstationLoginSection
          workstationCredentials={workstationCredentials}
          accessMethodLabel="Built-in Lab Terminal"
          terminalAvailable
          onOpenTerminal={openTerminal}
        />
      ) : null}

      <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">{GAME_UI.workstationAccess}</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">Type</dt>
            <dd className="mt-0.5 font-medium text-gray-200">{profileName}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">Access</dt>
            <dd className="mt-0.5 text-xs text-muted">
              {isVmWorkstation ? 'VirtualBox VM window' : 'Built-in Lab Terminal'}
            </dd>
          </div>
        </dl>

        {helper.workstationDistro ? (
          <p className="mt-2 text-[11px] text-muted-dim">
            {helper.workstationDistro}
            {helper.workstationShell ? ` · ${helper.workstationShell}` : ''}
          </p>
        ) : null}

        {!isVmWorkstation ? (
          <p className="mt-2 text-xs text-muted">{GAME_UI.terminalWorkstationNote}</p>
        ) : null}

        <div className="mt-3">
          <LabTerminalControls
            sessionId={session.sessionId}
            helper={helper}
            embedded
            hideDirectSshCommand
            onRegisterOpen={(fn) => {
              terminalOpenRef.current = fn
            }}
          />
        </div>

        <p className="mt-3 text-[11px] text-muted-dim">{GAME_UI.workstationThenTargetNote}</p>
      </section>
    </div>
  )
}

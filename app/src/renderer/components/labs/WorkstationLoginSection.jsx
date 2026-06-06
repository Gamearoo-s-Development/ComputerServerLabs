/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useState } from 'react'
import { Button } from '../ui/index.js'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { GAME_UI } from '../../constants/gameTone.js'
import { writeClipboardText } from '../../utils/clipboard.js'
import {
  workstationCredentialsVisible,
  workstationLoginGateRequired
} from '@sysadmin-game/shared/workstations/workstationLoginMode.js'
import WorkstationLoginGateModal from './WorkstationLoginGateModal.jsx'

/**
 * @param {{
 *   workstationCredentials?: object | null
 *   accessMethodLabel?: string
 *   onOpenDesktop?: () => void | Promise<void>
 *   onOpenTerminal?: () => void | Promise<void>
 *   desktopAvailable?: boolean
 *   terminalAvailable?: boolean
 *   children?: React.ReactNode
 * }} props
 */
export default function WorkstationLoginSection({
  workstationCredentials,
  accessMethodLabel = 'Lab Terminal',
  onOpenDesktop,
  onOpenTerminal,
  desktopAvailable = false,
  terminalAvailable = false,
  children
}) {
  const { notify } = useNotifications()
  const [gateOpen, setGateOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  const showCredentials = workstationCredentialsVisible(workstationCredentials)
  const gateRequired = workstationLoginGateRequired(workstationCredentials)

  const runProtectedAction = useCallback(
    async (action) => {
      if (!action) return
      if (gateRequired) {
        setPendingAction(() => action)
        setGateOpen(true)
        return
      }
      try {
        await action()
      } catch (e) {
        notify({
          title: 'Workstation access failed',
          body: e instanceof Error ? e.message : 'Could not open workstation.',
          tone: 'danger'
        })
      }
    },
    [gateRequired, notify]
  )

  const handleGateSuccess = useCallback(async () => {
    setGateOpen(false)
    const action = pendingAction
    setPendingAction(null)
    if (!action) return
    try {
      await action()
    } catch (e) {
      notify({
        title: 'Workstation access failed',
        body: e instanceof Error ? e.message : 'Could not open workstation.',
        tone: 'danger'
      })
    }
  }, [pendingAction, notify])

  const copyField = useCallback(
    async (text, label) => {
      if (!text) return
      try {
        await writeClipboardText(text)
        notify({ title: 'Copied', body: label, tone: 'info' })
      } catch {
        notify({ title: 'Copy failed', body: 'Could not access the clipboard.', tone: 'warning' })
      }
    },
    [notify]
  )

  const copyAllCredentials = useCallback(async () => {
    if (!workstationCredentials?.username) return
    const lines = [`${GAME_UI.workstationUsername}: ${workstationCredentials.username}`]
    if (workstationCredentials.password) {
      lines.push(`${GAME_UI.workstationPassword}: ${workstationCredentials.password}`)
    }
    await copyField(lines.join('\n'), 'Workstation credentials')
  }, [copyField, workstationCredentials])

  return (
    <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
        {GAME_UI.workstationLoginTitle}
      </h3>

      {showCredentials ? (
        <>
          <p className="mt-2 text-xs text-muted">{GAME_UI.workstationLoginNote}</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <dt className="text-muted">{GAME_UI.workstationUsername}</dt>
                <dd className="font-mono text-gray-200">{workstationCredentials?.username}</dd>
              </div>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => void copyField(workstationCredentials?.username, 'Username')}
              >
                Copy
              </Button>
            </div>
            {workstationCredentials?.password ? (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <dt className="text-muted">{GAME_UI.workstationPassword}</dt>
                  <dd className="font-mono text-gray-200">{workstationCredentials.password}</dd>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => void copyField(workstationCredentials.password, 'Password')}
                >
                  Copy
                </Button>
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <dt className="text-muted">{GAME_UI.workstationAccessMethod}</dt>
              <dd className="text-gray-200">{accessMethodLabel}</dd>
            </div>
          </dl>
          <div className="mt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => void copyAllCredentials()}>
              Copy all credentials
            </Button>
          </div>
          {workstationCredentials?.loginMode === 'app-gated' ? (
            <p className="mt-2 text-[11px] text-muted-dim">{GAME_UI.workstationLoginGateSecurityNote}</p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-xs text-muted">{GAME_UI.workstationIdentityNote}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {desktopAvailable && onOpenDesktop ? (
          <Button variant="primary" size="sm" type="button" onClick={() => void runProtectedAction(onOpenDesktop)}>
            Open Desktop
          </Button>
        ) : null}
        {terminalAvailable && onOpenTerminal ? (
          <Button
            variant={desktopAvailable ? 'secondary' : 'primary'}
            size="sm"
            type="button"
            onClick={() => void runProtectedAction(onOpenTerminal)}
          >
            Open Terminal
          </Button>
        ) : null}
      </div>

      {children}

      <WorkstationLoginGateModal
        open={gateOpen}
        workstationCredentials={workstationCredentials}
        onClose={() => {
          setGateOpen(false)
          setPendingAction(null)
        }}
        onSuccess={() => void handleGateSuccess()}
      />
    </section>
  )
}

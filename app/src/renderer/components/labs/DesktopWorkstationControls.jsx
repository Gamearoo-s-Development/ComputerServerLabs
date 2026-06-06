/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback } from 'react'
import { Button } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { useNotifications } from '../../context/NotificationContext.jsx'

/**
 * @param {{ helper?: object }} props
 */
export default function DesktopWorkstationControls({ helper }) {
  const { notify } = useNotifications()
  const desktopUrl = helper?.workstationDesktopUrl ?? null

  const handleOpen = useCallback(async () => {
    if (!desktopUrl) {
      notify({
        title: 'Desktop not ready',
        body: 'The Windows desktop viewer URL is not available yet. Wait for the lab to finish starting.',
        tone: 'warning'
      })
      return
    }
    const api = getApi()
    try {
      if (api?.app?.openExternal) {
        await api.app.openExternal(desktopUrl)
      } else {
        window.open(desktopUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not open the desktop viewer.'
      notify({ title: 'Open Desktop failed', body: msg, tone: 'danger' })
    }
  }, [desktopUrl, notify])

  return (
    <section className="rounded-lg border border-border bg-background-elevated/60 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Windows desktop</h3>
      {helper?.workstationDesktopRuntimeLabel ? (
        <p className="mt-1 text-[11px] font-medium text-success">
          Desktop runtime: {helper.workstationDesktopRuntimeLabel}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        Full Windows desktop in a Docker-managed VM (dockur/windows). Opens the web viewer on localhost
        {helper?.workstationDesktopDockerRuntime === 'docker-wsl-kvm'
          ? ' (WSL-backed Docker for KVM)'
          : ''}
        . The VM may take several minutes on first boot.
      </p>
      {desktopUrl ? (
        <p className="mt-2 font-mono text-[10px] text-muted-dim break-all">{desktopUrl}</p>
      ) : (
        <p className="mt-2 text-[11px] text-warning">Desktop viewer URL will appear when the container is running.</p>
      )}
      <div className="mt-3">
        <Button variant="primary" size="sm" type="button" disabled={!desktopUrl} onClick={() => void handleOpen()}>
          Open Desktop
        </Button>
      </div>
    </section>
  )
}

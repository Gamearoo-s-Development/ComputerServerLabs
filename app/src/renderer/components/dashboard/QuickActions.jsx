/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { getApi } from '../../hooks/useApi.js'
import Button from '../ui/Button.jsx'
import Card from '../ui/Card.jsx'

/**
 * @param {{ onNavigate: (id: string) => void }} props
 */
export default function QuickActions({ onNavigate }) {
  const { notify } = useNotifications()

  async function openDiscord() {
    const api = getApi()
    const url = 'https://discord.com/app'
    if (api?.app?.openExternal) {
      await api.app.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener')
    }
    notify({ title: 'Opening Discord', body: 'Launching Discord in your browser.', tone: 'info' })
  }

  async function resumeLab() {
    const api = getApi()
    if (!api?.labs?.listActiveSessions) {
      onNavigate('labs')
      return
    }
    try {
      const result = await api.labs.listActiveSessions()
      const sessions = result?.ok ? (result.data?.sessions ?? []) : []
      if (sessions.length > 0) {
        notify({
          title: 'Resuming lab',
          body: 'Opening your active lab session.',
          tone: 'info'
        })
        onNavigate('labs')
        return
      }
    } catch {
      // fall through to warning
    }
    notify({
      title: 'No active lab',
      body: 'Pick a lab from Labs and deploy it when Docker is ready.',
      tone: 'warning'
    })
    onNavigate('labs')
  }

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Quick actions</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="primary" size="sm" onClick={resumeLab}>
          Resume Last Lab
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onNavigate('labs')}>
          Browse Labs
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onNavigate('tools')}>
          Run System Scan
        </Button>
        <Button variant="ghost" size="sm" onClick={openDiscord}>
          Open Discord
        </Button>
        <Button variant="ghost" size="sm" className="sm:col-span-2" onClick={() => onNavigate('tools')}>
          Troubleshooting
        </Button>
      </div>
    </Card>
  )
}

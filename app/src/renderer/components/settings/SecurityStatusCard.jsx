/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { getApi } from '../../hooks/useApi.js'
import { Card, StatusBadge } from '../ui/index.js'

/**
 * Security posture summary for Settings.
 */
export default function SecurityStatusCard({ developerMode = false }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const api = getApi()
    const result = await api?.security?.getStatus?.()
    if (result?.ok) {
      setStatus(result.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const electron = status?.electron
  const docker = status?.docker
  const terminal = status?.terminal

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold text-white">Security</h3>
      <p className="mb-3 text-xs text-muted">
        {status?.communityLabs?.disclaimer ??
          'Community labs are user-generated content and are not officially audited.'}
      </p>

      {loading ? (
        <p className="text-xs text-muted-dim">Loading security status…</p>
      ) : (
        <ul className="space-y-3 text-sm">
          <li className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <span className="text-gray-200">Electron sandbox</span>
            <StatusBadge variant="success" label="Renderer" value="Isolated" />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <span className="text-gray-200">Docker isolation</span>
            <StatusBadge
              variant={docker?.ready ? 'success' : 'warning'}
              label="Engine"
              value={docker?.ready ? 'Ready' : 'Offline'}
            />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <span className="text-gray-200">Safety Mode</span>
            <StatusBadge
              variant={docker?.safetyModeEnabled ? 'success' : 'danger'}
              label="Guards"
              value={docker?.safetyModeEnabled ? 'On' : 'Off'}
            />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <span className="text-gray-200">Lab terminal</span>
            <StatusBadge variant="success" label="PTY" value="Sandbox only" />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-gray-200">Active lab sessions</span>
            <span className="font-mono text-xs text-muted">{docker?.activeSessions ?? 0}</span>
          </li>
        </ul>
      )}

      <p className="mt-4 text-xs text-muted-dim">
        {electron?.label ?? 'Renderer cannot access Node, Docker, or the host shell directly.'}
      </p>
      <p className="mt-1 text-xs text-muted-dim">{terminal?.label}</p>
      <p className="mt-1 text-xs text-muted-dim">{status?.cleanup?.label}</p>

      {developerMode ? (
        <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Developer Mode reduces guardrails (locked ports, debug logs, Lab Builder). Disable when not
          authoring labs.
        </p>
      ) : null}
    </Card>
  )
}

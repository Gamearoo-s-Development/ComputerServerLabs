/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { Button } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'

/**
 * @param {{
 *   open: boolean
 *   scan: { summary?: object, resources?: object[] } | null
 *   onClose: () => void
 *   onResolved?: () => void
 * }} props
 */
export default function StaleLabResourcesModal({ open, scan, onClose, onResolved }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const summary = scan?.summary ?? {}
  const resources = scan?.resources ?? []

  const runCleanup = useCallback(async () => {
    const api = getApi()
    setBusy(true)
    setError(null)
    try {
      const result = await api?.app?.cleanupStaleLabResources?.()
      if (result?.ok) {
        onResolved?.()
        onClose()
      } else {
        setError(result?.error?.message ?? 'Cleanup failed.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }, [onClose, onResolved])

  const keepForDebugging = useCallback(async () => {
    const api = getApi()
    setBusy(true)
    try {
      await api?.app?.keepStaleLabResources?.()
      onClose()
    } finally {
      setBusy(false)
    }
  }, [onClose])

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Previous lab resources were found" size="md">
      <div className="space-y-4 px-6 py-5 text-sm text-muted">
        <p className="text-gray-200">
          Ephemeral Docker resources from a previous lab session are still on your system. Only CSL-managed
          resources are listed — your other Docker containers and networks are untouched.
        </p>
        <ul className="rounded-lg border border-border bg-background-elevated/40 px-3 py-2 text-xs">
          <li>{summary.containers ?? 0} container(s)</li>
          <li>{summary.networks ?? 0} network(s)</li>
          <li>{summary.volumes ?? 0} volume(s)</li>
          <li>{summary.images ?? 0} image(s)</li>
        </ul>
        {resources.length > 0 ? (
          <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-xs text-muted-dim">
            {resources.slice(0, 12).map((row) => (
              <li key={`${row.type}-${row.name}`}>
                {row.type}: {row.name}
                {row.sessionId ? ` (${row.sessionId.slice(0, 8)}…)` : ''}
              </li>
            ))}
            {resources.length > 12 ? <li>…and {resources.length - 12} more</li> : null}
          </ul>
        ) : null}
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void keepForDebugging()}>
          Keep for debugging
        </Button>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => void runCleanup()}>
          Clean up now
        </Button>
      </div>
    </Modal>
  )
}

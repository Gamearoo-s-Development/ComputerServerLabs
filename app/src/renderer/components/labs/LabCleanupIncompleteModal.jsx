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
 *   sessionId: string | null
 *   cleanup: object | null
 *   developerMode?: boolean
 *   onDismiss: () => void
 *   onResolved?: () => void
 * }} props
 */
export default function LabCleanupIncompleteModal({
  open,
  sessionId,
  cleanup,
  developerMode,
  onDismiss,
  onResolved
}) {
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [showResources, setShowResources] = useState(false)
  const [resources, setResources] = useState(null)

  const runAction = useCallback(
    async (action) => {
      const api = getApi()
      if (!sessionId || !api?.labs) return
      setBusy(true)
      setLocalError(null)
      try {
        if (action === 'show') {
          const result = await api.labs.listSessionResources(sessionId)
          if (result?.ok) {
            setResources(result.data)
            setShowResources(true)
          } else {
            setLocalError(result?.error?.message ?? 'Could not list resources.')
          }
          return
        }

        const result = await api.labs.retryCleanup(sessionId, { force: action === 'force' })
        if (result?.ok && result.data?.ok) {
          onResolved?.()
          onDismiss()
        } else if (result?.ok) {
          setLocalError(
            result.data?.errors?.map((row) => row.message).join('; ') ??
              'Some CSL-managed resources could not be removed.'
          )
        } else {
          setLocalError(result?.error?.message ?? 'Cleanup failed.')
        }
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : 'Request failed.')
      } finally {
        setBusy(false)
      }
    },
    [sessionId, onDismiss, onResolved]
  )

  const leftovers = cleanup?.leftovers ?? []
  const errors = cleanup?.errors ?? []

  return (
    <Modal open={open} onClose={busy ? undefined : onDismiss} title="Cleanup incomplete" size="md">
      <div className="space-y-4 px-6 py-5 text-sm text-muted">
        <p className="text-gray-200">
          The lab session ended, but some CSL-managed Docker resources could not be fully removed.
        </p>
        {leftovers.length > 0 ? (
          <ul className="list-inside list-disc rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
            {leftovers.slice(0, 8).map((row) => (
              <li key={`${row.type}-${row.name}`}>
                {row.type}: <span className="font-mono">{row.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {errors.length > 0 ? (
          <ul className="list-inside list-disc rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {errors.map((row) => (
              <li key={`${row.type}-${row.name}-${row.message}`}>{row.message}</li>
            ))}
          </ul>
        ) : null}
        {showResources && resources ? (
          <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-background-elevated/60 p-3 text-xs text-muted-dim">
            {JSON.stringify(resources, null, 2)}
          </pre>
        ) : null}
        {developerMode && cleanup?.developerDetails ? (
          <details className="text-xs text-muted-dim">
            <summary className="cursor-pointer text-accent">Developer details</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded border border-border p-2">
              {JSON.stringify(cleanup.developerDetails, null, 2)}
            </pre>
          </details>
        ) : null}
        {localError ? <p className="text-xs text-danger">{localError}</p> : null}
        <p className="text-xs text-muted-dim">
          Only containers, networks, volumes, and images labeled <span className="font-mono">sgq.managed=true</span>{' '}
          are affected. Non-CSL Docker resources are never removed.
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onDismiss}>
          Dismiss
        </Button>
        <Button variant="secondary" size="sm" disabled={busy || !sessionId} onClick={() => void runAction('show')}>
          Show resources
        </Button>
        <Button variant="secondary" size="sm" disabled={busy || !sessionId} onClick={() => void runAction('retry')}>
          Retry cleanup
        </Button>
        <Button variant="danger" size="sm" disabled={busy || !sessionId} onClick={() => void runAction('force')}>
          Force cleanup
        </Button>
      </div>
    </Modal>
  )
}

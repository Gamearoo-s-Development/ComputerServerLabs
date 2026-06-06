/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { Button } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'

/**
 * @param {{
 *   open: boolean
 *   setups: object[]
 *   onClose: () => void
 *   onResume: (sessionId: string) => void
 *   onDiscard: (sessionId: string) => void
 * }} props
 */
export default function DesktopSetupRecoveryModal({ open, setups, onClose, onResume, onDiscard }) {
  const [busy, setBusy] = useState(false)

  async function handleDiscard(sessionId) {
    const api = getApi()
    setBusy(true)
    try {
      const setup = setups.find((row) => row.sessionId === sessionId)
      if (setup?.labId && api?.labs?.stop) {
        await api.labs.stop(sessionId, { force: true })
      }
      onDiscard(sessionId)
      if (setups.length <= 1) onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Desktop setup in progress" size="md">
      <div className="space-y-4 px-6 py-5 text-sm text-muted">
        <p className="text-gray-200">
          A previous desktop lab setup was found with install progress preserved. Resume waiting for the
          desktop to finish, or discard the setup and remove containers.
        </p>
        <ul className="space-y-2">
          {setups.map((setup) => (
            <li
              key={setup.sessionId}
              className="rounded-lg border border-border bg-background-elevated/40 px-3 py-3 text-xs"
            >
              <p className="font-mono text-gray-200">{setup.labId}</p>
              <p className="mt-1 text-muted-dim">{setup.workstationProfileName ?? 'Desktop workstation'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={() => onResume(setup.sessionId)}
                >
                  Continue waiting
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void handleDiscard(setup.sessionId)}>
                  Discard setup
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}

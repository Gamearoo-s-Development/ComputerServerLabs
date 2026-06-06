/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import Modal from '../ui/Modal.jsx'
import { Button } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'

const DEFAULT_SETUP_URL =
  'https://learn.microsoft.com/virtualization/windowscontainers/quick-start/set-up-environment'

/**
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   optionName?: string
 *   reasons?: string[]
 *   setupUrl?: string
 * }} props
 */
export default function WorkstationWhyDisabledModal({
  open,
  onClose,
  optionName,
  reasons = [],
  setupUrl = DEFAULT_SETUP_URL
}) {
  async function openInstructions() {
    const api = getApi()
    await api?.app?.openExternal?.(setupUrl)
    onClose()
  }

  const bullets =
    reasons.length > 0
      ? reasons
      : [
          'This workstation cannot be deployed on your system right now.',
          'Linux container workstations remain the recommended default.'
        ]

  return (
    <Modal open={open} onClose={onClose} title="Why is this disabled?" size="sm">
      <div className="space-y-4 px-6 py-5">
        {optionName ? (
          <p className="text-sm text-muted">
            <span className="text-gray-200">{optionName}</span> is not available for deployment yet.
          </p>
        ) : null}
        <ul className="list-disc space-y-2 pl-4 text-xs text-muted">
          {bullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-dim">
          You can still author labs that use Windows workstations in Lab Builder. Only starting a session requires the
          correct Docker mode.
        </p>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void openInstructions()}>
            Open setup guide
          </Button>
        </div>
      </div>
    </Modal>
  )
}

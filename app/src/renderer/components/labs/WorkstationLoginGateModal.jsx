/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { Button } from '../ui/index.js'
import { GAME_UI } from '../../constants/gameTone.js'

/**
 * @param {{
 *   open: boolean
 *   workstationCredentials?: object | null
 *   onClose: () => void
 *   onSuccess: () => void
 * }} props
 */
export default function WorkstationLoginGateModal({
  open,
  workstationCredentials,
  onClose,
  onSuccess
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [hostname, setHostname] = useState('')
  const [error, setError] = useState(null)

  const expectedHostname = 'lab-workstation'

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!workstationCredentials) return
    const userOk = username.trim() === workstationCredentials.username
    const passOk = password === workstationCredentials.password
    const hostOk = hostname.trim() === expectedHostname
    if (userOk && passOk && hostOk) {
      setError(null)
      setUsername('')
      setPassword('')
      setHostname('')
      onSuccess()
      return
    }
    setError('Workstation username, password, or hostname is incorrect.')
  }

  const handleClose = () => {
    setError(null)
    setUsername('')
    setPassword('')
    setHostname('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Workstation Login" size="md">
      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        <p className="text-sm text-muted">{GAME_UI.workstationLoginGateIntro}</p>
        <p className="text-xs text-muted-dim">{GAME_UI.workstationLoginGateSecurityNote}</p>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
            {GAME_UI.username}
          </span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-gray-200"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
            {GAME_UI.password}
          </span>
          <input
            type="password"
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-gray-200"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
            Hostname
          </span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-gray-200"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            autoComplete="off"
            placeholder="lab-workstation"
          />
        </label>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit">
            Continue
          </Button>
        </div>
      </form>
    </Modal>
  )
}

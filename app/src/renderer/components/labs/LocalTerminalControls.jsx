/*

 * This Source Code Form is subject to the terms of the Mozilla Public

 * License, v. 2.0. If a copy of the MPL was not distributed with this

 * file, You can obtain one at https://mozilla.org/MPL/2.0/.

 */



import React, { useCallback, useState } from 'react'

import { Button } from '../ui/index.js'

import { getApi } from '../../hooks/useApi.js'

import { useNotifications } from '../../context/NotificationContext.jsx'



/**

 * @param {{ session: object, variant?: 'host' | 'wsl', embedded?: boolean }} props

 */

export default function LocalTerminalControls({ session, variant = 'host', embedded = false }) {

  const { notify } = useNotifications()

  const [busy, setBusy] = useState(false)

  const isWsl = variant === 'wsl'



  const hostRoute =

    session.connectionRoutes?.find((r) => r.context === 'hostPc') ?? session.connection ?? null



  const openLocalTerminal = useCallback(async () => {

    const api = getApi()

    if (!api?.labs?.openLocalTerminal) return

    setBusy(true)

    try {

      const res = await api.labs.openLocalTerminal(session.sessionId)

      if (res?.ok) {

        notify({

          title: isWsl ? 'WSL terminal opened' : 'Local terminal opened',

          body: isWsl

            ? 'Use the SSH command shown in the connection panel. Commands affect your WSL environment.'

            : 'Use the SSH command shown in the connection panel. Commands affect your real computer.',

          tone: 'warning'

        })

      } else {

        notify({

          title: 'Could not open terminal',

          body: res?.error?.message ?? 'Unknown error',

          tone: 'danger'

        })

      }

    } catch (e) {

      notify({

        title: 'Could not open terminal',

        body: e instanceof Error ? e.message : 'Request failed',

        tone: 'danger'

      })

    } finally {

      setBusy(false)

    }

  }, [session.sessionId, notify, isWsl])



  const inner = (
    <>

      {!embedded ? <p className="text-xs font-medium text-warning">Not sandboxed</p> : null}

      <p className="text-xs text-muted">

        {isWsl

          ? 'WSL Local Linux Terminal uses your real WSL distribution. Commands may affect files inside your WSL environment. Docker container workstations are safer.'

          : 'Local Terminal Workstation uses your real system terminal. Commands may affect your computer. Use Docker or VM workstations whenever possible.'}

      </p>

      {hostRoute?.command ? (

        <p className="break-all font-mono text-[11px] text-gray-300">{hostRoute.command}</p>

      ) : null}

      <Button variant="secondary" size="sm" disabled={busy} onClick={() => void openLocalTerminal()}>

        {isWsl ? 'Open WSL terminal' : 'Open local terminal'}

      </Button>

    </>

  )

  if (embedded) {
    return <div className="space-y-3">{inner}</div>
  }

  return <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-3">{inner}</div>

}


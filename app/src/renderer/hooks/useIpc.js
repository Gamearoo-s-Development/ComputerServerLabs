/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useState } from 'react'
import { getApi } from './useApi.js'

/**
 * Typed IPC helper with loading/error state for renderer calls.
 */
export function useIpc() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const invoke = useCallback(async (fn, ...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn(...args)
      if (result && result.ok === false) {
        setError(result.error?.message ?? 'Request failed')
      }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed'
      setError(message)
      return { ok: false, error: { message } }
    } finally {
      setLoading(false)
    }
  }, [])

  return { api: getApi(), loading, error, invoke, clearError: () => setError(null) }
}

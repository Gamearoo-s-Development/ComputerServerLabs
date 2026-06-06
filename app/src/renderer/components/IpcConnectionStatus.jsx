/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useRef, useState } from 'react'
import { getApi, hasPreloadBridge } from '../hooks/useApi.js'
import { devLog } from '../utils/devLog.js'
import { cn } from '../utils/cn.js'

/** @typedef {'connecting' | 'connected' | 'disconnected' | 'error'} ConnectionState */

const RETRY_MS = 3000
const STABLE_SUCCESS_COUNT = 2

/**
 * @param {ConnectionState} status
 */
function statusLabel(status) {
  if (status === 'connected') return 'Connected'
  if (status === 'connecting') return 'Connecting…'
  if (status === 'error') return 'Error'
  return 'Disconnected'
}

/**
 * @param {ConnectionState} status
 */
function dotClass(status) {
  if (status === 'connected') return 'bg-success'
  if (status === 'connecting') return 'bg-accent animate-pulse'
  if (status === 'error') return 'bg-warning'
  return 'bg-danger'
}

/**
 * @param {ConnectionState} status
 */
function textClass(status) {
  if (status === 'connected') return 'text-success'
  if (status === 'connecting') return 'text-accent'
  if (status === 'error') return 'text-warning'
  return 'text-danger'
}

/**
 * IPC health indicator with on-demand retry until stable.
 */
export default function IpcConnectionStatus() {
  const [mainStatus, setMainStatus] = useState(
    /** @type {ConnectionState} */ ('connecting')
  )
  const [preloadStatus, setPreloadStatus] = useState(
    /** @type {ConnectionState} */ (hasPreloadBridge() ? 'connected' : 'disconnected')
  )
  const successStreakRef = useRef(0)
  const stableRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    /** @type {ReturnType<typeof setTimeout> | null} */
    let retryTimer = null

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
    }

    const scheduleRetry = () => {
      if (cancelled || stableRef.current) return
      clearRetry()
      retryTimer = setTimeout(() => {
        void probe()
      }, RETRY_MS)
    }

    async function probe() {
      if (cancelled || stableRef.current) return

      const preloadReady = hasPreloadBridge()
      if (!preloadReady) {
        setPreloadStatus('disconnected')
        setMainStatus('disconnected')
        devLog('ipc', 'Preload bridge missing (window.api.system.ping)')
        scheduleRetry()
        return
      }

      setPreloadStatus('connected')
      setMainStatus('connecting')

      const api = getApi()
      if (!api?.system?.ping) {
        setMainStatus('disconnected')
        devLog('ipc', 'API unavailable after preload detected')
        scheduleRetry()
        return
      }

      try {
        const result = await api.system.ping()
        if (cancelled) return

        if (result?.ok && result.data?.main) {
          setMainStatus('connected')
          setPreloadStatus('connected')
          successStreakRef.current += 1
          devLog('ipc', 'Ping OK', result.data)

          if (successStreakRef.current >= STABLE_SUCCESS_COUNT) {
            stableRef.current = true
            devLog('ipc', 'Connection stable; stopping retries')
            return
          }
        } else {
          successStreakRef.current = 0
          setMainStatus('error')
          devLog('ipc', 'Ping returned failure', result)
        }
      } catch (error) {
        if (cancelled) return
        successStreakRef.current = 0
        setMainStatus('error')
        devLog('ipc', 'Ping threw', error)
      }

      scheduleRetry()
    }

    void probe()

    return () => {
      cancelled = true
      clearRetry()
    }
  }, [])

  return (
    <div
      className="mt-2 flex flex-wrap gap-3 rounded-lg border border-border/60 bg-background-elevated/40 px-3 py-2 text-[10px] sm:text-xs"
      aria-label="IPC connection status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5 text-muted">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClass(mainStatus))} aria-hidden="true" />
        Main Process:
        <span className={cn('font-medium', textClass(mainStatus))}>{statusLabel(mainStatus)}</span>
      </span>
      <span className="flex items-center gap-1.5 text-muted">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClass(preloadStatus))} aria-hidden="true" />
        Preload:
        <span className={cn('font-medium', textClass(preloadStatus))}>{statusLabel(preloadStatus)}</span>
      </span>
    </div>
  )
}

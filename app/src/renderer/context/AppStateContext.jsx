/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getApi } from '../hooks/useApi.js'

const AppStateContext = createContext(null)

export function AppStateProvider({ children }) {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [profile, setProfile] = useState(null)
  const [rank, setRank] = useState(null)
  const [ranks, setRanks] = useState([])
  const [stats, setStats] = useState(null)
  const [xpMeta, setXpMeta] = useState(null)
  const [progression, setProgression] = useState(null)
  const [database, setDatabase] = useState(null)
  const [labProfileSetupComplete, setLabProfileSetupComplete] = useState(null)
  const [dataDirectory, setDataDirectory] = useState(null)
  const [isDevelopmentUnpackaged, setIsDevelopmentUnpackaged] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async ({ force = false, silent = false } = {}) => {
    const api = getApi()
    if (!api?.tools?.getStatus || !api?.progress?.get) {
      setLoading(false)
      setError('API unavailable')
      return
    }

    try {
      if (force && !silent) setLoading(true)

      const toolsFn = force && api.tools.refreshStatus ? api.tools.refreshStatus : api.tools.getStatus

      const [toolsResult, progressResult] = await Promise.all([toolsFn(), api.progress.get()])

      if (!toolsResult.ok) {
        setError(toolsResult.error?.message ?? 'Tool status failed')
        return
      }
      if (!progressResult.ok) {
        setError(progressResult.error?.message ?? 'Progress load failed')
        return
      }

      setStatus(toolsResult.data)
      setProfile(progressResult.data.profile)
      setRank(progressResult.data.rank)
      setRanks(progressResult.data.ranks ?? [])
      setStats(progressResult.data.stats ?? null)
      setXpMeta(progressResult.data.xpMeta ?? null)
      setProgression(progressResult.data.progression ?? null)
      setDatabase(progressResult.data.database ?? null)
      setLabProfileSetupComplete(progressResult.data.labProfileSetupComplete ?? null)
      setIsDevelopmentUnpackaged(progressResult.data.isDevelopmentUnpackaged === true)
      setDataDirectory(progressResult.data.dataDirectory ?? null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const applySettingsPatch = useCallback((partial) => {
    setProfile((current) => {
      if (!current) return current
      return {
        ...current,
        settings: { ...current.settings, ...partial }
      }
    })
  }, [])

  const applyStatus = useCallback((nextStatus) => {
    if (nextStatus) setStatus(nextStatus)
  }, [])

  useEffect(() => {
    const api = getApi()
    api?.progress?.seedDemoActivity?.()
    refresh({ force: false })
  }, [refresh])

  const value = useMemo(
    () => ({
      loading,
      status,
      profile,
      rank,
      ranks,
      stats,
      xpMeta,
      progression,
      database,
      labProfileSetupComplete,
      dataDirectory,
      isDevelopmentUnpackaged,
      error,
      refresh,
      applyStatus,
      applySettingsPatch,
      pills: status?.pills ?? [],
      dockerReady: status?.dockerReady ?? false
    }),
    [
      loading,
      status,
      profile,
      rank,
      ranks,
      stats,
      xpMeta,
      progression,
      database,
      labProfileSetupComplete,
      dataDirectory,
      isDevelopmentUnpackaged,
      error,
      refresh,
      applyStatus,
      applySettingsPatch
    ]
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider')
  }
  return ctx
}

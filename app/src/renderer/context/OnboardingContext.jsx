/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from './AppStateContext.jsx'
import OnboardingWizard from '../components/onboarding/OnboardingWizard.jsx'
import WindowsSetupWizard from '../components/onboarding/WindowsSetupWizard.jsx'
import { getApi } from '../hooks/useApi.js'

const OnboardingContext = createContext(null)

function readOnboardingCompleted(profile) {
  return profile?.settings?.onboardingCompleted === true
}

export function OnboardingProvider({ children }) {
  const { profile, refresh, applySettingsPatch } = useAppState()
  const [manualOpen, setManualOpen] = useState(false)
  const [manualWindowsOpen, setManualWindowsOpen] = useState(false)
  const [sessionDismissed, setSessionDismissed] = useState(false)
  const [windowsCheckDone, setWindowsCheckDone] = useState(false)
  const [showWindowsWizard, setShowWindowsWizard] = useState(false)
  const completingRef = useRef(false)

  const settingsLoaded = profile?.settings != null
  const persistedCompleted = readOnboardingCompleted(profile)
  const windowsSetupComplete = profile?.settings?.windowsSetupComplete === true

  useEffect(() => {
    if (!settingsLoaded) return
    let cancelled = false
    void getApi()
      ?.setup?.runWindowsChecks?.({})
      .then((res) => {
        if (cancelled) return
        const isWindows = res?.ok && res.data?.isWindows === true
        const needsWindowsWizard =
          isWindows && !windowsSetupComplete && !sessionDismissed && !manualWindowsOpen
        setShowWindowsWizard(needsWindowsWizard || manualWindowsOpen)
        setWindowsCheckDone(true)
      })
      .catch(() => {
        if (!cancelled) setWindowsCheckDone(true)
      })
    return () => {
      cancelled = true
    }
  }, [settingsLoaded, windowsSetupComplete, sessionDismissed, manualWindowsOpen])

  const shouldShowOnboarding =
    settingsLoaded &&
    windowsCheckDone &&
    !showWindowsWizard &&
    !sessionDismissed &&
    !completingRef.current &&
    (manualOpen || !persistedCompleted)

  const finishOnboarding = useCallback(async () => {
    if (completingRef.current) return
    completingRef.current = true

    const api = getApi()
    const result = await api?.settings?.set?.({
      onboardingCompleted: true,
      disclaimerAccepted: true
    })
    if (result?.ok) {
      applySettingsPatch?.({ onboardingCompleted: true, disclaimerAccepted: true })
      setSessionDismissed(true)
      setManualOpen(false)
    }
    await refresh({ silent: true })
    completingRef.current = false
  }, [applySettingsPatch, refresh])

  const finishWindowsSetup = useCallback(async () => {
    applySettingsPatch?.({ windowsSetupComplete: true })
    setShowWindowsWizard(false)
    setManualWindowsOpen(false)
    await refresh({ silent: true })
  }, [applySettingsPatch, refresh])

  const skipWindowsSetup = useCallback(() => {
    setShowWindowsWizard(false)
    setManualWindowsOpen(false)
  }, [])

  const rerunOnboarding = useCallback(async () => {
    completingRef.current = false
    setSessionDismissed(false)

    const api = getApi()
    const result = await api?.settings?.set?.({ onboardingCompleted: false })
    if (result?.ok) {
      applySettingsPatch?.({ onboardingCompleted: false })
    }
    setManualOpen(true)
    await refresh({ silent: true })
  }, [applySettingsPatch, refresh])

  const rerunWindowsSetup = useCallback(async () => {
    const api = getApi()
    const result = await api?.settings?.set?.({ windowsSetupComplete: false })
    if (result?.ok) {
      applySettingsPatch?.({ windowsSetupComplete: false })
    }
    setManualWindowsOpen(true)
    setShowWindowsWizard(true)
    setWindowsCheckDone(true)
    await refresh({ silent: true })
  }, [applySettingsPatch, refresh])

  const value = useMemo(() => ({ rerunOnboarding, rerunWindowsSetup }), [rerunOnboarding, rerunWindowsSetup])

  return (
    <OnboardingContext.Provider value={value}>
      {showWindowsWizard ? (
        <WindowsSetupWizard onComplete={finishWindowsSetup} onSkip={skipWindowsSetup} />
      ) : null}
      {shouldShowOnboarding ? (
        <OnboardingWizard onComplete={finishOnboarding} onSkip={finishOnboarding} />
      ) : null}
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider')
  return ctx
}

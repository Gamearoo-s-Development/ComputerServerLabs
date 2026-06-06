/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useState } from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import WhySafeSection from '../safety/WhySafeSection.jsx'
import { Button, Card, StatusBadge } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { DISCLAIMER_BULLETS, GAME_UI } from '../../constants/gameTone.js'
import { cn } from '../../utils/cn.js'

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'disclaimer', title: 'Disclaimer' },
  { id: 'profile', title: 'Player profile' },
  { id: 'docker', title: 'Docker' },
  { id: 'safety', title: 'Safety Mode' },
  { id: 'discord', title: 'Discord RPC' },
  { id: 'health', title: GAME_UI.systemScan },
  { id: 'done', title: 'Ready' }
]

/**
 * @param {{ onComplete: () => void, onSkip: () => void }} props
 */
export default function OnboardingWizard({ onComplete, onSkip }) {
  const { refresh, dockerReady, status, profile } = useAppState()
  const [step, setStep] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(() => profile?.settings?.disclaimerAccepted === true)
  const [discordEnabled, setDiscordEnabled] = useState(
    () => profile?.settings?.discordRpcEnabled !== false
  )
  const [displayName, setDisplayName] = useState(
    () => profile?.labProfile?.displayName ?? profile?.username ?? ''
  )
  const [experienceLevel, setExperienceLevel] = useState(
    () => profile?.labProfile?.experienceLevel ?? 'beginner'
  )

  const current = STEPS[step]

  const runHealthCheck = useCallback(async () => {
    setScanning(true)
    try {
      await refresh({ force: true, silent: true })
    } finally {
      setScanning(false)
    }
  }, [refresh])

  const saveDiscordPref = useCallback(async () => {
    const api = getApi()
    await api?.settings?.set?.({ discordRpcEnabled: discordEnabled })
  }, [discordEnabled])

  const saveDisclaimer = useCallback(async () => {
    const api = getApi()
    await api?.settings?.set?.({ disclaimerAccepted: true })
  }, [])

  const saveProfilePref = useCallback(async () => {
    const api = getApi()
    const name = displayName.trim() || 'Player'
    await api?.profile?.saveLabProfile?.({
      displayName: name,
      experienceLevel,
      setupCompleted: true
    })
  }, [displayName, experienceLevel])

  const goNext = useCallback(async () => {
    if (current.id === 'disclaimer') {
      if (!disclaimerAccepted) return
      await saveDisclaimer()
    }
    if (current.id === 'profile') {
      await saveProfilePref()
    }
    if (current.id === 'discord') {
      await saveDiscordPref()
    }
    if (current.id === 'health') {
      await runHealthCheck()
    }
    if (step >= STEPS.length - 1) {
      await onComplete()
      return
    }
    setStep((s) => s + 1)
  }, [current.id, disclaimerAccepted, onComplete, runHealthCheck, saveDisclaimer, saveDiscordPref, saveProfilePref, step])

  const goBack = () => setStep((s) => Math.max(0, s - 1))

  const handleSkip = useCallback(async () => {
    await saveProfilePref()
    await saveDiscordPref()
    await onSkip()
  }, [onSkip, saveDiscordPref, saveProfilePref])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 p-4 backdrop-blur-md">
      <Card className="w-full max-w-xl animate-fade-in border-accent/25 shadow-glow">
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-accent">First launch setup</p>
            <h1 className="text-lg font-semibold text-white">{current.title}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip
          </Button>
        </div>

        <div className="px-6 py-5">
          <div className="mb-5 flex gap-1">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  i <= step ? 'bg-accent' : 'bg-border'
                )}
              />
            ))}
          </div>

          {current.id === 'welcome' ? (
            <div className="space-y-3 text-sm text-muted">
              <p>{GAME_UI.welcomeBlurb}</p>
              <p>This quick setup explains requirements and runs a read-only health scan. You can rerun it anytime from Settings.</p>
            </div>
          ) : null}

          {current.id === 'disclaimer' ? (
            <div className="space-y-4 text-sm text-muted">
              <div className="space-y-2">
                <p className="text-white font-semibold">{GAME_UI.disclaimerTitle}</p>
                <ul className="list-disc space-y-1 pl-5">
                  {DISCLAIMER_BULLETS.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background-elevated/60 p-3">
                <input
                  type="checkbox"
                  checked={disclaimerAccepted}
                  onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                  className="mt-1 rounded border-border text-accent focus:ring-accent/40"
                />
                <span className="text-gray-200">I understand</span>
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void getApi()?.app?.quit?.()}
                >
                  Exit application
                </Button>
              </div>
            </div>
          ) : null}

          {current.id === 'profile' ? (
            <div className="space-y-3 text-sm text-muted">
              <p>Choose a player display name. Progress is stored locally on this device only.</p>
              <label className="block">
                <span className="text-xs uppercase text-muted-dim">Display name</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm text-white"
                  maxLength={64}
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase text-muted-dim">Experience</span>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm text-white"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>
          ) : null}

          {current.id === 'docker' ? (
            <div className="space-y-3 text-sm text-muted">
              <p>Container labs require Docker Desktop or the Docker engine running on your machine.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Install Docker for your platform if missing.</li>
                <li>Start the daemon before launching labs.</li>
                <li>SSH-based labs map container port 22 to a host port (e.g. 2222).</li>
              </ul>
              <StatusBadge
                label="Docker"
                value={dockerReady ? 'Ready' : 'Not ready'}
                variant={dockerReady ? 'success' : 'warning'}
                pulse={!dockerReady}
              />
            </div>
          ) : null}

          {current.id === 'safety' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Safety Mode is enabled by default. It blocks privileged containers, host volume mounts, and validation
                types that could touch your host system.
              </p>
              <WhySafeSection />
            </div>
          ) : null}

          {current.id === 'discord' ? (
            <div className="space-y-3 text-sm text-muted">
              <p>
                Optional Discord Rich Presence shows high-level activity (e.g. browsing labs, running a lab).
                It never exposes passwords, ports, or file paths.
              </p>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background-elevated/60 p-3">
                <input
                  type="checkbox"
                  checked={discordEnabled}
                  onChange={(e) => setDiscordEnabled(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent/40"
                />
                <span className="text-gray-200">Enable Discord Rich Presence</span>
              </label>
            </div>
          ) : null}

          {current.id === 'health' ? (
            <div className="space-y-3 text-sm text-muted">
              <p>We&apos;ll scan Docker, hypervisors, and platform tools. Diagnostics are read-only.</p>
              <Button variant="secondary" size="sm" disabled={scanning} onClick={runHealthCheck}>
                {scanning ? 'Scanning…' : 'Run system scan now'}
              </Button>
              {status?.pills?.length ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {status.pills.slice(0, 4).map((pill) => (
                    <StatusBadge
                      key={pill.label}
                      label={pill.label}
                      value={pill.value}
                      variant={pill.variant ?? 'neutral'}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {current.id === 'done' ? (
            <div className="space-y-3 text-sm text-muted">
              <p className="text-success font-medium">Setup complete — labs await.</p>
              <p>
                Browse labs from the sidebar, track {GAME_UI.playerProgress.toLowerCase()}, and unlock achievements as you go.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-between gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" size="sm" disabled={step === 0} onClick={goBack}>
            Back
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={goNext}
            disabled={current.id === 'disclaimer' && !disclaimerAccepted}
          >
            {step >= STEPS.length - 1 ? 'Finish' : 'Continue'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

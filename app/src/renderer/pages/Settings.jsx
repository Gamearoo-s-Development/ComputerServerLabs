/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useAppState } from '../context/AppStateContext.jsx'
import { useOnboarding } from '../context/OnboardingContext.jsx'
import WhySafeSection from '../components/safety/WhySafeSection.jsx'
import SecurityStatusCard from '../components/settings/SecurityStatusCard.jsx'
import { getApi } from '../hooks/useApi.js'
import { DISCLAIMER_BULLETS, GAME_UI } from '../constants/gameTone.js'
import { Button, Card, SectionTitle, StatusBadge } from '../components/ui/index.js'
import Modal from '../components/ui/Modal.jsx'
import WorkstationDockerStatusPanel from '../components/workstation/WorkstationDockerStatusPanel.jsx'
import WorkstationWhyDisabledModal from '../components/workstation/WorkstationWhyDisabledModal.jsx'
import DesktopRuntimeSettings from '../components/settings/DesktopRuntimeSettings.jsx'
import { normalizeWorkstationLoginMode } from '@sysadmin-game/shared/workstations/workstationLoginMode.js'

function ToggleRow({ label, description, enabled, onChange, disabled = false, title }) {
  return (
    <li className="flex flex-col gap-3 border-b border-border py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div title={title}>
        <span className="text-gray-200">{label}</span>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      </div>
      <Button
        variant={enabled ? 'primary' : 'secondary'}
        size="sm"
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        aria-pressed={enabled}
      >
        {enabled ? 'On' : 'Off'}
      </Button>
    </li>
  )
}

/**
 * @param {{ onNavigate?: (id: string) => void }} props
 */
export default function Settings({ onNavigate }) {
  const { profile, database, refresh, dataDirectory, isDevelopmentUnpackaged } = useAppState()
  const { rerunOnboarding, rerunWindowsSetup } = useOnboarding()

  const [theme, setTheme] = useState('dark')
  const [safetyMode, setSafetyMode] = useState(true)
  const [discordRpc, setDiscordRpc] = useState(true)
  const [reducedAnimations, setReducedAnimations] = useState(false)
  const [mockValidation, setMockValidation] = useState(false)
  const [ambient, setAmbient] = useState(false)
  const [keepLabImagesCache, setKeepLabImagesCache] = useState(false)
  const [discordStatus, setDiscordStatus] = useState(null)
  const [deletingData, setDeletingData] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [developerMode, setDeveloperMode] = useState(false)
  const [showLabDebugInfo, setShowLabDebugInfo] = useState(false)
  const [labBuilderUnsafeOverride, setLabBuilderUnsafeOverride] = useState(false)
  const [allowLocalTerminalWorkstation, setAllowLocalTerminalWorkstation] = useState(false)
  const [allowWslLocalTerminalWorkstation, setAllowWslLocalTerminalWorkstation] = useState(false)
  const [labWorkstationPreference, setLabWorkstationPreference] = useState('auto')
  const [workstationLoginMode, setWorkstationLoginMode] = useState('tty-login')
  const [workstationPreferenceOptions, setWorkstationPreferenceOptions] = useState([])
  const [workstationProfiles, setWorkstationProfiles] = useState([])
  const [workstationEnvironment, setWorkstationEnvironment] = useState(null)
  const [whyWorkstationOption, setWhyWorkstationOption] = useState(null)
  const [disclaimerOpen, setDisclaimerOpen] = useState(false)
  const [onlineRegistryBaseUrl, setOnlineRegistryBaseUrl] = useState('http://127.0.0.1:8080')
  const [savingOnlineUrls, setSavingOnlineUrls] = useState(false)

  const persistedSettings = profile?.settings

  const loadDiscordStatus = useCallback(async () => {
    const api = getApi()
    const result = await api?.discord?.getStatus?.()
    if (result?.ok) setDiscordStatus(result.data)
  }, [])

  useEffect(() => {
    const api = getApi()
    api?.discord?.updatePresence?.({ page: 'settings' })
    loadDiscordStatus()
  }, [loadDiscordStatus])

  useEffect(() => {
    if (!persistedSettings) return
    setTheme(persistedSettings.theme ?? 'dark')
    setSafetyMode(persistedSettings.safetyModeEnabled !== false)
    setDiscordRpc(persistedSettings.discordRpcEnabled !== false)
    setReducedAnimations(persistedSettings.reducedAnimations ?? false)
    setMockValidation(persistedSettings.mockValidationModeDevOnly ?? false)
    setAmbient(persistedSettings.ambientAudio ?? false)
    setKeepLabImagesCache(persistedSettings.keepLabImagesCache === true)
    setDeveloperMode(persistedSettings.developerMode === true)
    setShowLabDebugInfo(persistedSettings.showLabDebugInfo === true)
    setLabBuilderUnsafeOverride(persistedSettings.labBuilderUnsafeOverride === true)
    setAllowLocalTerminalWorkstation(persistedSettings.allowLocalTerminalWorkstation === true)
    setAllowWslLocalTerminalWorkstation(persistedSettings.allowWslLocalTerminalWorkstation === true)
    setLabWorkstationPreference(
      persistedSettings.labWorkstationPreference ??
        persistedSettings.labWorkstationProfile ??
        'auto'
    )
    setWorkstationLoginMode(
      normalizeWorkstationLoginMode(persistedSettings.workstationLoginMode ?? 'tty-login')
    )
    setOnlineRegistryBaseUrl(
      persistedSettings.onlineWebsiteBaseUrl ??
        persistedSettings.onlineApiBaseUrl ??
        'http://127.0.0.1:8080'
    )
  }, [persistedSettings])

  useEffect(() => {
    const api = getApi()
    api?.workstation?.listProfiles?.().then((result) => {
      if (!result?.ok || !result.data) return
      if (Array.isArray(result.data.preferenceOptions)) {
        setWorkstationPreferenceOptions(result.data.preferenceOptions)
      }
      if (Array.isArray(result.data.profiles)) {
        setWorkstationProfiles(result.data.profiles)
      } else if (Array.isArray(result.data)) {
        setWorkstationProfiles(result.data)
      }
      if (result.data.environment) {
        setWorkstationEnvironment(result.data.environment)
      } else if (result.data.capabilities) {
        const caps = result.data.capabilities
        setWorkstationEnvironment({
          hostOs: caps.hostOs,
          hostOsLabel: caps.hostOsLabel,
          dockerReady: caps.dockerReady,
          dockerModeLabel: caps.dockerModeLabel,
          windowsWorkstation: caps.windowsWorkstation
        })
      }
    })
  }, [])

  async function saveOnlineRegistryUrls() {
    const registryUrl = onlineRegistryBaseUrl.trim().replace(/\/$/, '')
    if (!/^https?:\/\/.+/i.test(registryUrl)) {
      window.alert('Registry site URL must start with http:// or https://')
      return
    }
    if (/:8787(?:\/|$)/.test(registryUrl)) {
      window.alert('Use your website URL (e.g. http://127.0.0.1:8080), not the internal API port 8787.')
      return
    }
    setSavingOnlineUrls(true)
    try {
      await save({ onlineApiBaseUrl: registryUrl, onlineWebsiteBaseUrl: registryUrl })
      setOnlineRegistryBaseUrl(registryUrl)
    } finally {
      setSavingOnlineUrls(false)
    }
  }

  async function save(partial, options) {
    const api = getApi()
    await api?.settings?.set?.(partial, options)
    await refresh()
    await loadDiscordStatus()
  }

  async function toggleSafetyMode(next) {
    if (!next) {
      const confirmed = window.confirm(
        'Disabling Safety Mode reduces container and validation guardrails. Only turn this off if you understand the risks. Continue?'
      )
      if (!confirmed) return
      await save({ safetyModeEnabled: false }, { confirmSafetyOff: true })
    } else {
      await save({ safetyModeEnabled: true })
    }
    setSafetyMode(next)
  }

  async function deleteAllLocalData() {
    const confirmed = window.confirm(
      'Delete ALL local app data (progress, lab session secrets, profile, settings)? The app will recreate an empty data folder. This cannot be undone.'
    )
    if (!confirmed) return
    setDeletingData(true)
    try {
      const api = getApi()
      await api?.data?.resetAll?.({ confirmed: true, keepSettings: false })
      await refresh({ force: true })
    } finally {
      setDeletingData(false)
    }
  }

  async function resetProgress() {
    const confirmed = window.confirm(
      'Reset all XP, lab progress, achievements, and quiz attempts? This cannot be undone.'
    )
    if (!confirmed) return

    setResetting(true)
    try {
      const api = getApi()
      await api?.progress?.reset?.()
      await refresh({ force: true })
    } finally {
      setResetting(false)
    }
  }

  async function handleRerunWindowsSetup() {
    const confirmed = window.confirm('Show the Windows WSL & Docker setup wizard again?')
    if (!confirmed) return
    await rerunWindowsSetup()
  }

  async function handleRerunOnboarding() {
    const confirmed = window.confirm('Show the first-launch setup wizard again?')
    if (!confirmed) return
    await rerunOnboarding()
  }

  const discordVariant = discordStatus?.variant ?? 'neutral'

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <SectionTitle
        title="Settings"
        description="Local preferences only — progress stays on this device."
      />

      <Card>
        <Modal open={disclaimerOpen} onClose={() => setDisclaimerOpen(false)} title={GAME_UI.disclaimerTitle} size="lg">
          <div className="space-y-3 px-6 py-5 text-sm text-muted">
            <ul className="list-disc space-y-2 pl-5">
              {DISCLAIMER_BULLETS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <Button variant="ghost" size="sm" onClick={() => setDisclaimerOpen(false)}>Close</Button>
          </div>
        </Modal>

        <h3 className="mb-1 text-sm font-semibold text-white">Appearance</h3>
        <p className="mb-2 text-xs text-muted">Visual theme and motion preferences.</p>
        <ul className="text-sm">
          <li className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-gray-200">Theme</span>
              <p className="mt-1 text-xs text-muted">Dark mode is the MVP default. Light theme ships in a later release.</p>
            </div>
            <span className="rounded-md bg-background-elevated px-2 py-1 text-xs capitalize text-muted">{theme}</span>
          </li>
          <ToggleRow
            label="Reduced animations"
            description="Minimize motion for backgrounds, cards, and page transitions."
            enabled={reducedAnimations}
            onChange={async (next) => {
              setReducedAnimations(next)
              await save({ reducedAnimations: next })
            }}
          />
          <ToggleRow
            label="Ambient audio"
            description="Quiet synthesized datacenter ambience — no network requests."
            enabled={ambient}
            onChange={async (next) => {
              setAmbient(next)
              await save({ ambientAudio: next })
            }}
          />
        </ul>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Safety</h3>
        <p className="mb-2 text-xs text-muted">Host protection boundaries for container labs.</p>
        <ul className="text-sm">
          <ToggleRow
            label="Safety Mode"
            title="Blocks privileged containers and host mounts by default"
            description="Enabled by default. Disabling requires confirmation in production builds."
            enabled={safetyMode}
            onChange={toggleSafetyMode}
          />
        </ul>
        <div className="mt-4">
          <WhySafeSection />
        </div>
        <ul className="mt-4 text-sm">
          <ToggleRow
            label="Keep built lab images cache"
            description="When off, locally built lab images are removed when a lab ends or the app exits (Remove cached lab images on exit)."
            enabled={keepLabImagesCache}
            onChange={async (next) => {
              setKeepLabImagesCache(next)
              await save({ keepLabImagesCache: next })
            }}
          />
        </ul>
      </Card>

      <SecurityStatusCard developerMode={developerMode} />

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Safety &amp; Legal</h3>
        <p className="mb-3 text-xs text-muted">
          {GAME_UI.safetyLegalBlurb}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDisclaimerOpen(true)}>
            View Disclaimer
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void getApi()?.app?.openDoc?.('security-model')}
            title="Opens docs in your browser/editor"
          >
            View Security Model
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void getApi()?.app?.openDoc?.('security-hardening')}
          >
            Hardening checklist
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void getApi()?.app?.openDoc?.('threat-model')}
          >
            Threat model
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void getApi()?.app?.openDoc?.('windows-build')}
          >
            Windows build guide
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void getApi()?.app?.openDoc?.('security-electron-notes')}
          >
            Electron security notes
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void getApi()?.app?.openDataFolder?.()}>
            Open Data Folder
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const api = getApi()
              const res = await api?.app?.runCleanupNow?.()
              if (!res?.ok) {
                alert(res?.error?.message ?? 'Cleanup failed')
                return
              }
              alert('Cleanup completed.')
              await refresh({ force: true })
            }}
          >
            Run Cleanup Now
          </Button>
        </div>
        <div className="mt-3 text-xs text-muted">
          <p>Safety Mode is currently <span className="font-semibold text-gray-200">{safetyMode ? 'ON' : 'OFF'}</span>.</p>
          <p className="mt-1">
            Community labs are user-created and may contain mistakes, unstable configurations, or unsafe practices.
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Discord RPC</h3>
        <p className="mb-2 text-xs text-muted">Optional Rich Presence — high-level activity only.</p>
        <ul className="text-sm">
          <ToggleRow
            label="Discord Rich Presence"
            description="Shows browsing labs or active lab title. Never passwords or commands."
            enabled={discordRpc}
            onChange={async (next) => {
              setDiscordRpc(next)
              await save({ discordRpcEnabled: next })
            }}
          />
          <li className="flex flex-col gap-2 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-gray-200">Connection status</span>
              <p className="mt-1 text-xs text-muted">Fails gracefully when Discord is closed.</p>
            </div>
            <StatusBadge variant={discordVariant} label="RPC" value={discordStatus?.label ?? 'Checking…'} />
          </li>
        </ul>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Performance &amp; setup</h3>
        <ul className="text-sm">
          <li className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-gray-200">Windows lab setup</span>
              <p className="mt-1 text-xs text-muted">
                Check WSL 2, Docker Desktop, and run a hello-world test container.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleRerunWindowsSetup}>
              Run Windows setup
            </Button>
          </li>
          <li className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-gray-200">Setup wizard</span>
              <p className="mt-1 text-xs text-muted">Rerun the first-launch onboarding flow.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleRerunOnboarding}>
              Run onboarding again
            </Button>
          </li>
          {onNavigate ? (
            <li className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-gray-200">Docker setup guide</span>
                <p className="mt-1 text-xs text-muted">Install and verify Docker for container labs.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('setup/docker')}>
                Open guide
              </Button>
            </li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Online registry</h3>
        <p className="mb-3 text-xs text-muted">
          The app reaches the registry through your <strong>website</strong> at <span className="font-mono text-gray-300">/api</span>
          — not the internal API port. Production:{' '}
          <span className="font-mono text-gray-300">https://computerserverlabs.com</span>. Local Docker:{' '}
          <span className="font-mono text-gray-300">http://127.0.0.1:8080</span>.
        </p>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-gray-200">Registry site URL</span>
            <p className="mt-1 text-xs text-muted">
              Online Labs, sync, publish, and account linking all use this site (API calls go to /api on the same host).
            </p>
            <input
              type="url"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-gray-100"
              value={onlineRegistryBaseUrl}
              onChange={(e) => setOnlineRegistryBaseUrl(e.target.value)}
              placeholder="https://computerserverlabs.com"
            />
          </label>
          <Button size="sm" disabled={savingOnlineUrls} onClick={() => void saveOnlineRegistryUrls()}>
            {savingOnlineUrls ? 'Saving…' : 'Save registry site URL'}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Desktop Runtime</h3>
        <p className="mb-4 text-xs text-muted">
          Configure Docker/QEMU desktop workstation images (Ubuntu, Debian, Kali, Windows). Community presets
          such as LinuxServer Webtop are not auto-trusted — review and test before use.
        </p>
        <DesktopRuntimeSettings />
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Lab Workstation</h3>
        <p className="mb-3 text-xs text-muted">
          Default workstation for new lab sessions. Labs can recommend or require a specific environment.
          Linux terminal containers are recommended; desktop workstations (including Windows via WSL/KVM) are
          available under Desktop Runtime.
        </p>
        <WorkstationDockerStatusPanel environment={workstationEnvironment} className="mb-4" />
        <ul className="text-sm">
          {workstationPreferenceOptions.map((option) => {
            const selected = labWorkstationPreference === option.id
            const disabled = option.available === false
            const profileDetail =
              option.id === 'auto'
                ? null
                : workstationProfiles.find((profile) => profile.id === option.id)
            return (
              <li
                key={option.id}
                className="flex flex-col gap-3 border-b border-border py-4 last:border-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-gray-200">{option.name}</span>
                    {option.badge === 'recommended' ? (
                      <StatusBadge label="Workstation" value="Recommended" variant="success" />
                    ) : null}
                    {option.badge === 'advanced' ? (
                      <StatusBadge label="Workstation" value="Advanced" variant="neutral" />
                    ) : null}
                    {disabled ? (
                      <StatusBadge label="Deploy" value="Unavailable now" variant="neutral" />
                    ) : null}
                  </div>
                  {option.badgeHint ? (
                    <p className="mt-1 text-[10px] text-muted-dim">{option.badgeHint}</p>
                  ) : null}
                  {option.id === 'auto' ? (
                    <p className="mt-1 text-xs text-muted">
                      Use each lab&apos;s recommended workstation when supported on this system. Falls back to Linux
                      when a recommended option is unavailable.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">
                      {profileDetail?.description ?? option.unavailableMessage ?? ''}
                    </p>
                  )}
                  {disabled && option.unavailableMessage ? (
                    <p className="mt-2 text-[11px] text-warning">{option.unavailableMessage}</p>
                  ) : null}
                  {disabled ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => setWhyWorkstationOption(option)}
                    >
                      Why?
                    </Button>
                  ) : null}
                  {profileDetail?.tools?.length ? (
                    <p className="mt-2 text-[11px] text-muted-dim">
                      Tools: {profileDetail.tools.join(', ')}
                      {profileDetail.estimatedImageSizeMb
                        ? ` · ~${profileDetail.estimatedImageSizeMb} MB image`
                        : ''}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant={selected ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={disabled}
                  onClick={async () => {
                    if (disabled) return
                    setLabWorkstationPreference(option.id)
                    await save({
                      labWorkstationPreference: option.id,
                      labWorkstationProfile: option.id === 'auto' ? 'auto' : option.id
                    })
                  }}
                  aria-pressed={selected}
                >
                  {selected ? 'Selected' : 'Select'}
                </Button>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Workstation Login</h3>
        <p className="mb-3 text-xs text-muted">
          Controls how the lab workstation terminal authenticates before shell access. Lab target
          credentials remain separate.
        </p>
        <ul className="text-sm">
          {[
            {
              id: 'tty-login',
              label: 'TTY login (default)',
              description:
                'Open the terminal at a Linux login prompt. Enter workstation username and password at the prompt.'
            },
            {
              id: 'app-gated',
              label: 'App-gated access',
              description:
                'Require an in-app login step before opening the desktop viewer or terminal, then attach the shell directly.'
            },
            {
              id: 'auto-login',
              label: 'Auto-login',
              description:
                'Attach the workstation shell immediately without a login step (training shortcut).'
            }
          ].map((option) => {
            const selected = workstationLoginMode === option.id
            return (
              <li
                key={option.id}
                className="flex flex-col gap-3 border-b border-border py-4 last:border-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-gray-200">{option.label}</span>
                  <p className="mt-1 text-xs text-muted">{option.description}</p>
                </div>
                <Button
                  variant={selected ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setWorkstationLoginMode(option.id)
                    void save({ workstationLoginMode: option.id })
                  }}
                >
                  {selected ? 'Selected' : 'Select'}
                </Button>
              </li>
            )
          })}
        </ul>
      </Card>

      <WorkstationWhyDisabledModal
        open={Boolean(whyWorkstationOption)}
        onClose={() => setWhyWorkstationOption(null)}
        optionName={whyWorkstationOption?.name}
        reasons={whyWorkstationOption?.disabledReasons}
      />

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Developer options</h3>
        <ul className="text-sm">
          <ToggleRow
            label="Developer Mode"
            description="Shows Lab Builder navigation to edit Docker drafts stored under lab-builder/drafts in your app data folder."
            enabled={developerMode}
            onChange={async (next) => {
              if (next) {
                const confirmed = window.confirm(
                  'Developer Mode enables the Lab Builder (local draft labs, not the shipped catalog).\n\n' +
                    'Docker test runs from the builder never award XP or player progress.\n\n' +
                    'Only enable this if you trust content you create or import.\n\nEnable Developer Mode?'
                )
                if (!confirmed) return
              }
              setDeveloperMode(next)
              if (!next) {
                setShowLabDebugInfo(false)
                await save({ developerMode: next, showLabDebugInfo: false })
              } else {
                await save({ developerMode: next })
              }
            }}
          />
          <ToggleRow
            label="Allow Local Terminal Workstation (advanced)"
            description="Enables an opt-in, not-sandboxed workstation that opens your real system terminal. Still requires per-lab permission and confirmation each session. Disabled by default."
            enabled={allowLocalTerminalWorkstation}
            onChange={async (next) => {
              if (next) {
                const confirmed = window.confirm(
                  'Local Terminal Workstation uses your real shell — commands can affect your computer.\n\n' +
                    'Only enable if you understand the risk. Sandboxed Docker workstations are strongly recommended.\n\nEnable anyway?'
                )
                if (!confirmed) return
              }
              setAllowLocalTerminalWorkstation(next)
              await save({
                allowLocalTerminalWorkstation: next,
                ...(next ? {} : { localTerminalRiskAcknowledged: false })
              })
            }}
          />
          <ToggleRow
            label="Allow WSL Local Linux Terminal (advanced, Windows)"
            description="Enables an opt-in workstation that opens your real WSL distribution. Requires WSL 2, per-lab permission, and confirmation each session. Docker container workstations remain recommended."
            enabled={allowWslLocalTerminalWorkstation}
            onChange={async (next) => {
              if (next) {
                const confirmed = window.confirm(
                  'WSL Local Linux Terminal uses your real WSL distro — commands may affect files inside WSL.\n\n' +
                    'This is not an isolated lab sandbox. Only enable if you understand the risk.\n\nEnable anyway?'
                )
                if (!confirmed) return
              }
              setAllowWslLocalTerminalWorkstation(next)
              await save({
                allowWslLocalTerminalWorkstation: next,
                ...(next ? {} : { wslLocalTerminalRiskAcknowledged: false })
              })
            }}
          />
          {developerMode ? (
            <ToggleRow
              label="Show internal lab debug info"
              description="When on, lab sessions may show validation paths, internal objectives, host SSH commands, and container IDs. Requires Developer Mode."
              enabled={showLabDebugInfo}
              onChange={async (next) => {
                setShowLabDebugInfo(next)
                await save({ showLabDebugInfo: next })
              }}
            />
          ) : null}
          {isDevelopmentUnpackaged ? (
            <ToggleRow
              label="Lab Builder unsafe override (dev only)"
              description="Allows export and Build/Test when the analyzer marks a draft as blocked. Use only for trusted debugging."
              enabled={labBuilderUnsafeOverride}
              onChange={async (next) => {
                if (next) {
                  const confirmed = window.confirm(
                    'This bypasses blocked safety findings for Lab Builder export and Docker test. Misused drafts can still harm your machine.\n\nEnable anyway?'
                  )
                  if (!confirmed) return
                }
                setLabBuilderUnsafeOverride(next)
                await save({ labBuilderUnsafeOverride: next })
              }}
            />
          ) : (
            <li className="border-b border-border py-4 last:border-0">
              <p className="text-xs text-muted">
                Lab Builder unsafe override is available only in unpackaged development builds.
              </p>
            </li>
          )}
          <ToggleRow
            label="Mock validation (dev only)"
            description="Pass validations without Docker in unpackaged dev builds."
            enabled={mockValidation}
            onChange={async (next) => {
              setMockValidation(next)
              await save({ mockValidationModeDevOnly: next })
            }}
          />
          <li className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-gray-200">Database location</span>
              <p className="mt-1 text-xs text-muted">SQLite progress database on this machine.</p>
            </div>
            <code className="max-w-full truncate rounded-md bg-background-elevated px-2 py-1 text-xs text-accent">
              {database?.path ?? 'Not initialized'}
            </code>
          </li>
        </ul>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-white">Local data folder</h3>
        <p className="mb-2 text-xs text-muted">
          All progress, settings, lab session secrets, and profile data live under Electron userData — never in the install directory.
        </p>
        <code className="block max-w-full truncate rounded-md bg-background-elevated px-2 py-1 text-xs text-accent">
          {dataDirectory?.root ?? database?.path ?? 'Loading…'}
        </code>
        <p className="mt-2 text-xs text-muted-dim">
          See <span className="font-mono">DATA_FOLDER.txt</span> in that folder for details.
        </p>
      </Card>

      <Card className="border-danger/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Delete all local data</h3>
            <p className="mt-1 text-xs text-muted">
              Removes progress, settings, lab session secrets, and profile. Recreates an empty data folder.
            </p>
          </div>
          <Button variant="secondary" size="sm" disabled={deletingData} onClick={deleteAllLocalData}>
            {deletingData ? 'Deleting…' : 'Delete all local data'}
          </Button>
        </div>
      </Card>

      <Card className="border-danger/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Reset progress</h3>
            <p className="mt-1 text-xs text-muted">
              Clears XP, completions, achievements, and quiz attempts. Settings are kept.
            </p>
          </div>
          <Button variant="secondary" size="sm" disabled={resetting} onClick={resetProgress}>
            {resetting ? 'Resetting…' : 'Reset progress'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

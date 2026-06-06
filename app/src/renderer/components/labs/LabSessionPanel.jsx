/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import { useNotifications } from '../../context/NotificationContext.jsx'
import SafetyBadge from '../safety/SafetyBadge.jsx'
import XpGainFlash from '../progress/XpGainFlash.jsx'
import WorkstationAccessSection from './WorkstationAccessSection.jsx'
import LabTerminalControls from './LabTerminalControls.jsx'
import LabTargetAccessSection from './LabTargetAccessSection.jsx'
import LabServiceRoutes from './LabServiceRoutes.jsx'
import ObjectiveQuestionControls from './ObjectiveQuestionControls.jsx'
import LabIncidentBanner from './LabIncidentBanner.jsx'
import LabPostLabReviewModal from './LabPostLabReviewModal.jsx'
import { Button, Card, StatusBadge } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { countObjectiveHintsAvailable } from '@sysadmin-game/shared/lab-format/labObjectiveHints.js'
import { cn } from '../../utils/cn.js'
import {
  COMMAND_CATALOG,
  findCatalogEntry,
  isBlockedCommand
} from '../../constants/commandGuide.js'
import { formatPortMappingLabel } from '../../utils/labPorts.js'
import { GAME_UI } from '../../constants/gameTone.js'
import {
  getObjectiveDisplayMode,
  getPublicObjectives,
  mergeObjectiveRowsForDisplay,
  shouldShowObjectivesInSession
} from '../../utils/labDisplay.js'
import { serviceRefHintText } from '../../utils/serviceRoutes.js'
import { seededShuffle } from '../../utils/seededShuffle.js'
import { writeClipboardText } from '../../utils/clipboard.js'

const DEFAULT_HINT_PENALTY = 10

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * @param {{
 *   session: object
 *   lab: object
 *   onClose: () => void
 *   onStop?: () => void
 *   onReset?: () => void | Promise<void>
 *   onComplete?: () => void
 *   onSessionUpdate?: (session: object) => void
 *   stopping?: boolean
 * }} props
 */
export default function LabSessionPanel({
  session,
  lab,
  onClose,
  onStop,
  onReset,
  onComplete,
  onSessionUpdate,
  stopping = false
}) {
  const { refresh, xpMeta, profile } = useAppState()
  const { notify } = useNotifications()
  const [labDetail, setLabDetail] = useState(null)
  const [validating, setValidating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [revealedObjectiveHints, setRevealedObjectiveHints] = useState({})
  const [textAnswer, setTextAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [validationHistory, setValidationHistory] = useState([])
  const [sshDiagnosticsReport, setSshDiagnosticsReport] = useState(null)
  const [sshDiagnosticsLoading, setSshDiagnosticsLoading] = useState(false)
  const [autoObjectives, setAutoObjectives] = useState([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const [revealHiddenObjectives, setRevealHiddenObjectives] = useState(false)
  const [postLabReview, setPostLabReview] = useState(null)
  const [incidentBrief, setIncidentBrief] = useState(null)
  const startedAtRef = useRef(Date.parse(session.startedAt) || 0)
  const autoCompleteTriggeredRef = useRef(false)
  const labTimerActive = session.activated !== false && Boolean(session.startedAt)

  useEffect(() => {
    autoCompleteTriggeredRef.current = false
  }, [session.sessionId])

  useEffect(() => {
    const api = getApi()
    if (!api?.labs?.get || !lab?.id) return
    api.labs.get(lab.id).then((res) => {
      if (res?.ok) setLabDetail(res.data)
    })
  }, [lab?.id])

  useEffect(() => {
    if (!labTimerActive) {
      setElapsedMs(0)
      return undefined
    }
    startedAtRef.current = Date.parse(session.startedAt) || Date.now()
    setElapsedMs(0)
    setResult(null)
    setValidationHistory([])
    setHintsUsed(0)
    setRevealedObjectiveHints({})
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current)
    }, 1000)
    return () => clearInterval(timer)
  }, [session.startedAt, session.sessionId, labTimerActive])

  const labForDisplay = labDetail ?? lab
  const objectiveStateRows = autoObjectives.length
    ? autoObjectives
    : getPublicObjectives(labForDisplay).map((o) => ({
        id: o.id,
        label: o.label,
        serviceRef: o.serviceRef,
        completed: false,
        status: 'pending'
      }))
  const objectiveRowsAll = mergeObjectiveRowsForDisplay(labForDisplay, objectiveStateRows)
  const showObjectives = shouldShowObjectivesInSession(labForDisplay, {
    revealHidden: revealHiddenObjectives || result?.passed === true
  })
  const objectiveRows = showObjectives ? objectiveRowsAll : []
  const objectiveDisplayMode = getObjectiveDisplayMode(labForDisplay)

  useEffect(() => {
    const api = getApi()
    if (!api?.labs?.incidentBriefing || !lab?.id) return
    void api.labs.incidentBriefing(lab.id).then((res) => {
      if (res?.ok) setIncidentBrief(res.data)
    })
  }, [lab?.id])

  const [serviceRoutes, setServiceRoutes] = useState(session.serviceRoutes ?? [])
  useEffect(() => {
    setServiceRoutes(session.serviceRoutes ?? [])
  }, [session.serviceRoutes, session.sessionId])

  const mappedPorts = useMemo(
    () => (session.ports ?? []).filter((p) => (p.hostPort ?? p.host ?? 0) > 0),
    [session.ports]
  )
  const publishedSshPort = useMemo(
    () =>
      mappedPorts.find(
        (p) => p.purpose === 'ssh' || (p.containerPort ?? p.container) === 22
      ) ?? null,
    [mappedPorts]
  )
  const username = session.credentials?.username ?? labDetail?.credentials?.username
  const password = session.credentials?.password ?? labDetail?.credentials?.password
  const sshConnection = session.connection ?? null
  const sshHost =
    sshConnection?.host ??
    session.credentials?.targetInternalIp ??
    session.helper?.targetInternalIp ??
    null
  const sshPort = sshConnection?.port ?? session.credentials?.sshPort ?? 22
  const sshCommand =
    sshConnection?.command ??
    (username && sshHost ? `ssh ${username}@${sshHost}` : null)
  const hintsAvailableCount = useMemo(
    () => countObjectiveHintsAvailable(labForDisplay),
    [labForDisplay]
  )
  const baseXp = labDetail?.xpReward ?? lab.xpReward ?? 0

  const [commandQuery, setCommandQuery] = useState('')
  const possibleCommands = useMemo(() => {
    const cfg = labDetail?.commandGuide ?? lab.commandGuide ?? null
    if (!cfg || cfg.enabled === false) return []

    /** @type {string[]} */
    const seeds = []
    for (const s of cfg.suggestedCommands ?? []) seeds.push(String(s))
    for (const s of cfg.redHerrings ?? []) seeds.push(String(s))

    /** @type {import('../../constants/commandGuide.js').CommandEntry[]} */
    const pool = []

    // Pull from explicit suggested/red-herring arrays first (but don’t label them).
    for (const item of seeds) {
      const entry = findCatalogEntry(item)
      if (entry && !pool.some((p) => p.key === entry.key)) pool.push(entry)
      if (!entry) {
        // Create a lightweight entry for unknown commands (still filtered by safety).
        pool.push({
          key: `custom-${item}`,
          command: item,
          explanation: 'May help in some labs.',
          example: item,
          difficulty: 'Easy',
          category: 'custom',
          warningLevel: isBlockedCommand(item) ? 'blocked' : 'none',
          mayHelp: true
        })
      }
    }

    // Add extra commands from selected categories (more than needed).
    const categories = Array.isArray(cfg.categories) ? cfg.categories.map(String) : []
    for (const entry of COMMAND_CATALOG) {
      if (categories.length && !categories.includes(entry.category)) continue
      if (pool.some((p) => p.key === entry.key)) continue
      pool.push(entry)
      if (pool.length >= 36) break
    }

    // Safety: hide truly destructive patterns.
    const safePool = pool.filter((e) => !isBlockedCommand(e.command) && e.warningLevel !== 'blocked')

    const shuffleSeed = String(
      session.variationSummary?.commandGuideSeed ?? session.variationSummary?.seed ?? session.sessionId ?? ''
    )
    return seededShuffle(safePool, shuffleSeed)
  }, [labDetail?.commandGuide, lab.commandGuide, session.sessionId, session.variationSummary])

  const filteredCommands = useMemo(() => {
    const q = commandQuery.trim().toLowerCase()
    if (!q) return possibleCommands
    return possibleCommands.filter((e) => {
      const hay = `${e.command} ${e.explanation} ${e.example} ${e.category}`.toLowerCase()
      return hay.includes(q)
    })
  }, [possibleCommands, commandQuery])

  const hintPenalty = xpMeta?.hintPenaltyPerHint ?? DEFAULT_HINT_PENALTY
  const xpPreview = useMemo(
    () => Math.max(xpMeta?.minimumXpReward ?? 10, baseXp - hintsUsed * hintPenalty),
    [baseXp, hintsUsed, hintPenalty, xpMeta?.minimumXpReward]
  )
  const isTextAnswer = (labDetail?.validation?.type ?? lab.validationType) === 'textAnswer'
  const hideDirectSshCommand = (labDetail?.hideDirectSshCommand ?? lab.hideDirectSshCommand) === true
  const discoverMode =
    session.accessMode === 'discover' ||
    labDetail?.accessMode === 'discover' ||
    lab.accessMode === 'discover'
  const securitySimulation =
    session.securitySimulation === true ||
    labDetail?.securitySimulation === true ||
    lab.securitySimulation === true ||
    labDetail?.category === GAME_UI.securitySimulationCategory ||
    lab.category === GAME_UI.securitySimulationCategory
  const isTargetOnlyLab =
    session.labMode === 'target-only' || session.helper?.isLabEnvironment === true
  const isLocalTerminal =
    !isTargetOnlyLab &&
    (session.helper?.workstationRuntime === 'local-terminal' ||
      session.helper?.workstationProvider === 'host-local-terminal')
  const isWslLocalTerminal =
    !isTargetOnlyLab &&
    (session.helper?.workstationRuntime === 'wsl-terminal' ||
      session.helper?.workstationProvider === 'host-wsl-terminal')
  const isHostTerminalWorkstation = isLocalTerminal || isWslLocalTerminal
  const isDesktopWorkstation =
    !isTargetOnlyLab &&
    !isHostTerminalWorkstation &&
    ((typeof session.helper?.workstationProvider === 'string' &&
      session.helper.workstationProvider.startsWith('desktop-container-')) ||
      (session.helper?.workstationAccessModes?.includes('desktop') === true &&
        !session.helper?.workstationAccessModes?.includes('terminal')))
  const isWindowsDesktopWorkstation =
    isDesktopWorkstation &&
    (session.helper?.workstationProvider === 'desktop-container-windows' ||
      session.helper?.workstationPlatform === 'windows')
  const showSshConnection =
    !isTargetOnlyLab &&
    (discoverMode || isHostTerminalWorkstation || !hideDirectSshCommand)
  const connectionRoutes = session.connectionRoutes ?? []
  const developerMode = profile?.settings?.developerMode === true
  const showLabDebugInfo = developerMode && profile?.settings?.showLabDebugInfo === true
  const validationDef = labDetail?.validation ?? lab.validation

  const copyText = useCallback(async (text, label) => {
    if (!text) return
    try {
      await writeClipboardText(text)
      notify({ title: 'Copied', body: label, tone: 'info' })
    } catch {
      // ignore
    }
  }, [notify])

  const revealHintForObjective = useCallback(
    (objectiveId) => {
      if (!objectiveId || revealedObjectiveHints[objectiveId]) return
      const row = objectiveRowsAll.find((o) => o.id === objectiveId)
      if (!row?.hint) return
      setRevealedObjectiveHints((prev) => ({ ...prev, [objectiveId]: true }))
      setHintsUsed((n) => n + 1)
      const api = getApi()
      void api?.labs?.recordTelemetry?.(session.sessionId, { type: 'hint', objectiveId })
    },
    [objectiveRowsAll, revealedObjectiveHints, session.sessionId]
  )

  const runValidation = useCallback(async () => {
    const api = getApi()
    if (!api?.labs?.validate) return

    setValidating(true)
    setError(null)
    setResult(null)

    try {
      const payload = {
        hintsUsed,
        ...(isTextAnswer ? { answer: textAnswer } : {})
      }
      const response = await api.labs.validate(session.sessionId, payload)
      if (response.ok) {
        const data = response.data
        setResult(data)
        setValidationHistory((prev) =>
          [
            {
              id: `val-${Date.now()}`,
              passed: data.passed,
              message: data.message,
              at: new Date().toISOString()
            },
            ...prev
          ].slice(0, 8)
        )
        if (Array.isArray(data.objectives)) {
          setAutoObjectives(data.objectives)
        }
        if (data.passed) {
          setRevealHiddenObjectives(true)
          if (data.postLabReview) {
            setPostLabReview(data.postLabReview)
          }
          if (data.builderTest) {
            notify({
              title: data.environmentRemoved ? 'Builder test complete' : 'Builder validation passed',
              body:
                data.message ??
                'No XP or catalog progress is saved during Lab Builder tests.',
              tone: 'success'
            })
          } else {
            const unlockBody =
              Array.isArray(data.newlyUnlockedLabs) && data.newlyUnlockedLabs.length > 0
                ? `New labs unlocked: ${data.newlyUnlockedLabs.map((l) => l.title).join(', ')}`
                : null
            notify({
              title: data.environmentRemoved ? GAME_UI.missionComplete : 'Lab check passed',
              body:
                unlockBody ??
                data.message ??
                (data.xpAwarded ? `+${data.xpAwarded} XP` : 'Objective met'),
              tone: data.xpAwarded ? 'xp' : 'success'
            })
            if (data.levelIncreased && data.level) {
              notify({
                title: 'Level up!',
                body: `You reached level ${data.level}.`,
                tone: 'success'
              })
            }
          }
          if (data.xpAwarded || data.newlyUnlockedLabs?.length) await refresh({ force: true })
          if (data.environmentRemoved && onComplete) {
            onComplete()
          }
        }
      } else {
        setError(response.error?.message ?? 'Validation failed')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation request failed')
    } finally {
      setValidating(false)
    }
  }, [session.sessionId, hintsUsed, textAnswer, isTextAnswer, refresh, notify, onComplete])

  useEffect(() => {
    const api = getApi()
    if (!api?.labs?.getObjectives || !session.sessionId) return undefined

    const poll = async () => {
      const res = await api.labs.getObjectives(session.sessionId)
      if (!res?.ok || !Array.isArray(res.data?.objectives)) return
      setAutoObjectives(res.data.objectives)
      if (
        res.data.allObjectivesComplete === true &&
        !autoCompleteTriggeredRef.current &&
        !validating &&
        result?.passed !== true
      ) {
        autoCompleteTriggeredRef.current = true
        void runValidation()
      }
    }

    void poll()
    const timer = setInterval(poll, 2000)
    return () => clearInterval(timer)
  }, [session.sessionId, runValidation, validating, result?.passed])

  const handleReset = useCallback(async () => {
    if (!onReset) return
    const confirmed = window.confirm(
      session.builderTest
        ? 'Reset will tear down this test container and start a fresh one from your draft files. Continue?'
        : 'Resetting will delete this attempt and generate a fresh lab.'
    )
    if (!confirmed) return
    setResetting(true)
    setResult(null)
    setValidationHistory([])
    try {
      await onReset()
    } finally {
      setResetting(false)
    }
  }, [onReset, session.builderTest])

  return (
    <Card className="border-accent/30 shadow-glow animate-fade-in">
      {session.builderTest ? (
        <div className="mb-4 rounded-lg border border-accent/35 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-accent">
          <strong className="text-white">Lab Builder test deployment.</strong> Validations run against your draft only — no XP
          or learner progress is saved. Credentials are disposable for this test.
        </div>
      ) : null}
      {incidentBrief?.ticket ? (
        <LabIncidentBanner ticket={incidentBrief.ticket} incident={incidentBrief.incident} className="mb-4" />
      ) : null}
      {objectiveDisplayMode === 'ticket-only' || objectiveDisplayMode === 'hidden' ? (
        <p className="mb-4 text-xs text-muted">
          {objectiveDisplayMode === 'ticket-only'
            ? 'Investigate using the incident ticket — objectives are not listed for this lab.'
            : 'Objectives unlock as you make progress.'}
        </p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Active lab deployment</p>
          <h2 className="mt-1 text-xl font-semibold text-white">{lab.title}</h2>
          <p className="mt-1 text-sm text-muted">{labDetail?.description ?? lab.description}</p>
          {showLabDebugInfo ? (
            <p className="mt-1 font-mono text-xs text-muted-dim">Session {session.sessionId}</p>
          ) : null}
          <p className="mt-2 text-[11px] text-muted-dim">
            Lab environments are procedurally deployed — each run may differ.
          </p>
          {session.message ? <p className="mt-2 text-xs text-warning">{session.message}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SafetyBadge compact />
          <StatusBadge label="Session" value="Running" variant="success" pulse />
          <StatusBadge
            label="Timer"
            value={labTimerActive ? formatElapsed(elapsedMs) : 'Not started'}
            variant={labTimerActive ? 'accent' : 'neutral'}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {objectiveRows.length > 0 ? (
            <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">{GAME_UI.missionObjectives}</h3>
              <ul className="mt-2 space-y-2">
                {objectiveRows.map((row, i) => {
                  const status = row.status ?? (row.completed ? 'completed' : 'pending')
                  const displayLabel = row.displayText ?? row.label ?? 'Unnamed objective'
                  const statusLabel =
                    status === 'incorrect'
                      ? 'incorrect'
                      : status === 'answered'
                        ? 'answered'
                        : status === 'detected'
                          ? 'detected'
                          : status

                  return (
                    <li key={row.id ?? i} className="space-y-2">
                      <label className="flex items-start gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={Boolean(row.completed)}
                          readOnly
                          className="mt-1 rounded border-border text-accent focus:ring-accent/40"
                        />
                        <span className={row.completed ? 'text-muted line-through' : ''}>{displayLabel}</span>
                        <span
                          className={cn(
                            'ml-auto text-[10px] uppercase tracking-wide',
                            status === 'completed'
                              ? 'text-success'
                              : status === 'incorrect'
                                ? 'text-warning'
                                : 'text-muted-dim'
                          )}
                        >
                          {statusLabel}
                        </span>
                      </label>
                      {row.serviceRef ? (
                        <p className="pl-6 text-[11px] text-muted-dim">
                          {serviceRefHintText(row.serviceRef, serviceRoutes)}
                        </p>
                      ) : null}
                      {row.hint ? (
                        <div className="pl-6">
                          {revealedObjectiveHints[row.id] ? (
                            <p className="rounded-md border border-accent/25 bg-accent/5 px-2 py-1.5 text-[11px] leading-relaxed text-gray-300">
                              {row.hint}
                            </p>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="!h-7 !px-2 text-[11px]"
                              onClick={() => revealHintForObjective(row.id)}
                            >
                              {GAME_UI.revealObjectiveHint}
                            </Button>
                          )}
                        </div>
                      ) : null}
                      {row.questions?.length > 0 ? (
                        <ObjectiveQuestionControls
                          sessionId={session.sessionId}
                          objectiveId={row.id}
                          questions={row.questions}
                          objectiveStatus={status}
                          objectiveCompleted={Boolean(row.completed)}
                          notify={notify}
                          onUpdated={(objectives, meta) => {
                            setAutoObjectives(objectives)
                            if (meta?.triggerValidation && !autoCompleteTriggeredRef.current) {
                              autoCompleteTriggeredRef.current = true
                              void runValidation()
                            }
                          }}
                          onSubmit={async (questionId, answer) => {
                            const api = getApi()
                            if (!api?.labs?.submitObjectiveAnswer) {
                              return { ok: false, error: { message: 'API unavailable' } }
                            }
                            return api.labs.submitObjectiveAnswer(
                              session.sessionId,
                              row.id,
                              answer,
                              questionId
                            )
                          }}
                        />
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          {securitySimulation ? (
            <section className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
              <p className="font-semibold uppercase tracking-wide">Security simulation</p>
              <p className="mt-1">{GAME_UI.securitySimulationWarning}</p>
            </section>
          ) : null}

          {isTargetOnlyLab ? (
            <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Lab environment</h3>
              <p className="mt-2 text-sm font-medium text-gray-200">
                {session.helper?.workstationProfileName ?? lab.title}
              </p>
              <p className="mt-2 text-xs text-muted">
                You are logged into the lab server directly — no SSH jump box. Use Open Lab Terminal when you are
                ready, complete the objectives, then Check.
              </p>
              {!discoverMode && username ? (
                <div className="mt-3 rounded-md border border-border/80 bg-background/50 px-3 py-2 text-xs">
                  <p className="font-semibold uppercase tracking-wide text-muted-dim">Lab credentials</p>
                  <dl className="mt-2 space-y-1 font-mono text-gray-200">
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-muted-dim">User</dt>
                      <dd>{username}</dd>
                    </div>
                    {password ? (
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-muted-dim">Password</dt>
                        <dd>{password}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className="mt-2 text-[11px] text-muted-dim">{GAME_UI.labSudoNote}</p>
                </div>
              ) : null}
              <div className="mt-3">
                <LabTerminalControls
                  sessionId={session.sessionId}
                  helper={session.helper}
                  embedded
                  hideDirectSshCommand
                />
              </div>
            </section>
          ) : (
            <WorkstationAccessSection
              session={session}
              isDesktopWorkstation={isDesktopWorkstation}
              isWindowsDesktopWorkstation={isWindowsDesktopWorkstation}
              isHostTerminalWorkstation={isHostTerminalWorkstation}
              isWslLocalTerminal={isWslLocalTerminal}
              onSessionUpdate={onSessionUpdate}
            />
          )}

          <LabServiceRoutes
            sessionId={session.sessionId}
            routes={serviceRoutes}
            onRoutesUpdated={setServiceRoutes}
          />

          {showSshConnection ? (
            <LabTargetAccessSection
              routes={connectionRoutes}
              username={discoverMode ? null : username}
              password={discoverMode ? null : password}
              sshReady={session.sshReady}
              helperSshReady={session.helper?.sshReady}
              hideSection={!discoverMode && hideDirectSshCommand && connectionRoutes.length === 0}
              discoverMode={discoverMode}
            />
          ) : null}

          {showLabDebugInfo && mappedPorts.length > 0 ? (
            <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Port mappings (debug)</h3>
              <p className="mt-1 text-[11px] text-muted-dim">Mapped ports for this lab deployment.</p>
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-gray-200">
                {mappedPorts.map((port) => (
                  <li key={`${port.container}-${port.protocol ?? 'tcp'}`} className="rounded bg-background/40 px-2 py-1">
                    {formatPortMappingLabel(port)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {showLabDebugInfo && showSshConnection ? (
            <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">SSH diagnostics</h3>
              <p className="mt-1 text-[11px] text-muted-dim">
                Runs checks inside the lab target container (sshd config, user, listeners, logs).
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={sshDiagnosticsLoading}
                  onClick={async () => {
                    const api = getApi()
                    setSshDiagnosticsLoading(true)
                    setSshDiagnosticsReport(null)
                    try {
                      const res = await api?.labs?.testSshReadiness?.(session.sessionId)
                      if (res?.ok) {
                        const report = res.data?.diagnostics?.report ?? ''
                        setSshDiagnosticsReport(report)
                        notify({
                          title: res.data.ready ? 'SSH ready' : 'SSH not ready',
                          body: res.data.ready
                            ? 'Internal SSH checks passed.'
                            : 'See the report below for sshd/user/listener details.',
                          tone: res.data.ready ? 'success' : 'warning'
                        })
                      } else {
                        notify({
                          title: 'SSH diagnostics failed',
                          body: res?.error?.message ?? 'Unknown error',
                          tone: 'danger'
                        })
                      }
                    } finally {
                      setSshDiagnosticsLoading(false)
                    }
                  }}
                >
                  {sshDiagnosticsLoading ? 'Running…' : 'Run SSH diagnostics'}
                </Button>
              </div>
              {sshDiagnosticsReport ? (
                <pre className="mt-3 max-h-72 overflow-auto rounded border border-border/60 bg-background/50 p-2 font-mono text-[10px] leading-relaxed text-gray-300">
                  {sshDiagnosticsReport}
                </pre>
              ) : null}
            </section>
          ) : null}

          {showLabDebugInfo && hideDirectSshCommand ? (
            <section className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-warning">Routing (debug)</h3>
              <p className="mt-1 text-[11px] text-muted">
                Host loopback access is blocked unless Developer Mode + Lab Builder unsafe override. In-simulation routing
                uses lab node aliases only in the UI.
              </p>
              {(session.helper?.startupWarnings ?? []).map((warning) => (
                <p key={warning} className="mt-2 text-[11px] text-warning">
                  {warning}
                </p>
              ))}
            </section>
          ) : null}

          {possibleCommands.length ? (
            <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">{GAME_UI.commandCodex}</h3>
                <span className="text-[11px] text-muted">
                  These may or may not help — choosing the right tool is part of the challenge.
                </span>
              </div>
              <input
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Search commands…"
                className="mt-2 w-full rounded-md border border-border bg-background-elevated px-2 py-1.5 text-xs text-white focus:border-accent focus:outline-none"
              />
              <ul className="mt-3 space-y-2">
                {filteredCommands.slice(0, 24).map((cmd) => (
                  <li key={cmd.key} className="rounded-lg border border-border/70 bg-background/30 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code className="break-all font-mono text-xs text-gray-200">{cmd.command}</code>
                      <div className="flex items-center gap-2">
                        {cmd.warningLevel && cmd.warningLevel !== 'none' ? (
                          <span className="rounded bg-warning/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-warning">
                            {cmd.warningLevel}
                          </span>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => copyText(cmd.command, 'Command')}>
                          Copy
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{cmd.explanation}</p>
                    <p className="mt-1 text-[11px] text-muted-dim">
                      Category: <span className="font-mono text-gray-300">{cmd.category}</span> · Difficulty:{' '}
                      <span className="font-mono text-gray-300">{cmd.difficulty}</span>
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-dim">
                Safety: run risky commands only inside the Lab Terminal. Avoid destructive commands on your host system.
              </p>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-border-muted bg-background/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-white">{GAME_UI.intel}</h3>
              <span className="text-xs text-muted">
                {GAME_UI.hintsUsedSummary(hintsUsed, hintsAvailableCount)}
                {hintsAvailableCount > 0 ? ` · −${hintPenalty} XP each` : ''}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">
              {hintsAvailableCount > 0
                ? 'Reveal a hint on the step you are stuck on — each objective has its own nudge.'
                : 'No hints are defined for this lab.'}
            </p>
          </section>

          <section className="rounded-lg border border-border-muted bg-background/40 p-3">
            <h3 className="text-sm font-medium text-white">{GAME_UI.submitMission}</h3>
            <p className="mt-1 text-xs text-muted">
              Lab validation checks only.
              {!session.builderTest ? (
                <>
                  {' '}
                  XP preview:{' '}
                  <span className="font-semibold text-accent">{xpPreview}</span>
                </>
              ) : (
                <span> Builder mode — XP preview disabled (nothing is awarded here).</span>
              )}
            </p>

            {isTextAnswer ? (
              <input
                type="text"
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Your answer…"
                className="mt-3 w-full rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" size="sm" disabled={validating || resetting} onClick={runValidation}>
                {validating ? GAME_UI.submitMissionChecking : GAME_UI.submitMission}
              </Button>
              {onReset ? (
                <Button variant="secondary" size="sm" disabled={validating || resetting} onClick={handleReset}>
                  {resetting ? 'Resetting…' : 'Reset Lab & Start Fresh'}
                </Button>
              ) : null}
              {onStop ? (
                <Button variant="ghost" size="sm" disabled={resetting || stopping} onClick={onStop}>
                  End Lab & Delete Attempt
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={onClose}>
                Dismiss
              </Button>
            </div>
          </section>

          {showLabDebugInfo && session.ports?.length ? (
            <p className="text-xs text-muted">
              Debug — mapped ports:{' '}
              {session.ports.map((p) => `${p.hostPort ?? p.host}→${p.containerPort ?? p.container}`).join(', ')}
            </p>
          ) : null}
        </div>
      </div>

      {validating ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-accent">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          Running lab validation…
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger animate-fade-in">
          {error}
        </p>
      ) : null}

      {result ? (
        <div
          className={cn(
            'mt-4 rounded-lg border px-4 py-3 text-sm animate-fade-in',
            result.passed
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-warning/30 bg-warning/10 text-warning'
          )}
        >
          <p className="font-semibold">{result.passed ? '✓ Success' : 'Not complete yet'}</p>
          <p className="mt-1 text-xs opacity-90">
            {result.environmentRemoved
              ? (result.message ?? `${GAME_UI.missionComplete}. Player progress saved. Lab environment cleared.`)
              : result.message}
          </p>
          {showLabDebugInfo && result.debugMessage ? (
            <p className="mt-2 font-mono text-[11px] opacity-80">{result.debugMessage}</p>
          ) : null}
          {result.mock ? (
            <p className="mt-1 text-xs opacity-80">Dev mock mode — deployment engine was offline.</p>
          ) : null}
          {result.passed && result.xpAwarded ? (
            <div className="mt-2">
              <XpGainFlash amount={result.xpAwarded} />
            </div>
          ) : null}
        </div>
      ) : null}

      {showLabDebugInfo && validationHistory.length > 0 ? (
        <section className="mt-4 rounded-lg border border-border bg-background-elevated/30 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Validation history (debug)</h3>
          <ul className="mt-2 space-y-1">
            {validationHistory.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-2 text-xs">
                <span className={entry.passed ? 'text-success' : 'text-warning'}>
                  {entry.passed ? 'Pass' : 'Fail'} — {entry.message}
                </span>
                <span className="shrink-0 text-muted-dim">{new Date(entry.at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showLabDebugInfo ? (
        <section className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-warning">Internal lab debug</h3>
          <dl className="mt-2 space-y-2 font-mono text-[11px] text-gray-300">
            <div>
              <dt className="text-muted-dim">Session</dt>
              <dd className="break-all">{session.sessionId}</dd>
            </div>
            {session.helper?.networkName ? (
              <div>
                <dt className="text-muted-dim">Session network</dt>
                <dd className="break-all">{session.helper.networkName}</dd>
              </div>
            ) : null}
            {session.helper?.networkSubnet ? (
              <div>
                <dt className="text-muted-dim">Subnet</dt>
                <dd className="break-all">{session.helper.networkSubnet}</dd>
              </div>
            ) : null}
            {session.helper?.networkAlias ? (
              <div>
                <dt className="text-muted-dim">Workstation alias</dt>
                <dd className="break-all">{session.helper.networkAlias}</dd>
              </div>
            ) : null}
            {session.helper?.targetAliases?.length ? (
              <div>
                <dt className="text-muted-dim">Target aliases</dt>
                <dd className="break-all">{session.helper.targetAliases.join(', ')}</dd>
              </div>
            ) : null}
            {session.helper?.targetInternalIp ? (
              <div>
                <dt className="text-muted-dim">Target internal IP (debug)</dt>
                <dd className="break-all">{session.helper.targetInternalIp}</dd>
              </div>
            ) : null}
            {session.containerId ? (
              <div>
                <dt className="text-muted-dim">Helper container</dt>
                <dd className="break-all">{session.containerId}</dd>
              </div>
            ) : null}
            {session.helper?.targetContainerId ? (
              <div>
                <dt className="text-muted-dim">Target container</dt>
                <dd className="break-all">{session.helper.targetContainerId}</dd>
              </div>
            ) : null}
            {validationDef ? (
              <div>
                <dt className="text-muted-dim">Validation</dt>
                <dd className="break-all">{JSON.stringify(validationDef)}</dd>
              </div>
            ) : null}
            {(labDetail?.objectives ?? lab.objectives)?.length ? (
              <div>
                <dt className="text-muted-dim">Internal objectives</dt>
                <dd className="break-all whitespace-pre-wrap">
                  {JSON.stringify(labDetail?.objectives ?? lab.objectives, null, 2)}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section className="mt-4 rounded-lg border border-border-muted bg-background/30 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Troubleshooting</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted">
          <li>Confirm the deployment shows as Running and the lab access route is online.</li>
          <li>
            Complete objectives inside{' '}
            {isTargetOnlyLab ? 'the lab target' : 'the Lab Terminal'}, then {GAME_UI.submitMission} again.
          </li>
          {!isTargetOnlyLab && !isDesktopWorkstation ? (
            <li>Use {GAME_UI.openMissionTerminal} — do not use your personal shell for lab work.</li>
          ) : null}
          {isDesktopWorkstation ? (
            <li>
              Use Open Desktop for the workstation, then SSH to the lab target from{' '}
              {isWindowsDesktopWorkstation ? 'inside Windows' : 'the desktop environment'}.
            </li>
          ) : null}
        </ul>
      </section>

      <p className="mt-3 text-[11px] text-muted-dim">
        All lab actions stay inside the simulated environment. Your real system is not the lab target.
      </p>

      <LabPostLabReviewModal
        open={Boolean(postLabReview)}
        review={postLabReview}
        labTitle={lab.title}
        onClose={() => setPostLabReview(null)}
      />
    </Card>
  )
}

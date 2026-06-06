/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '../context/AppStateContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import DockerOnboarding from '../components/dashboard/DockerOnboarding.jsx'
import LabDetailModal from '../components/labs/LabDetailModal.jsx'
import LabSessionPanel from '../components/labs/LabSessionPanel.jsx'
import MissionStartupModal from '../components/labs/MissionStartupModal.jsx'
import ChooseLabWorkstationModal from '../components/labs/ChooseLabWorkstationModal.jsx'
import LabIncidentBriefingModal from '../components/labs/LabIncidentBriefingModal.jsx'
import LabCleanupIncompleteModal from '../components/labs/LabCleanupIncompleteModal.jsx'
import DesktopSetupRecoveryModal from '../components/labs/DesktopSetupRecoveryModal.jsx'
import Modal from '../components/ui/Modal.jsx'
import {
  difficultyTone,
  estimatedMinutesForDifficulty,
  filterLabs,
  formatUnlockRequirements,
  labInitials,
  labProgressionBucket,
  labStatusBucket,
  labThumbnailStyle,
  runtimeIcon,
  sortLabs,
  uniqueCategories,
  uniqueRuntimes
} from '../components/labs/labBrowserUtils.js'
import { Button, Card, SectionTitle, Skeleton, StatusBadge } from '../components/ui/index.js'
import { getApi } from '../hooks/useApi.js'
import { devLog } from '../utils/devLog.js'
import { cn } from '../utils/cn.js'
import { GAME_UI } from '../constants/gameTone.js'

/**
 * @param {ReturnType<typeof getApi>} api
 * @param {string} labId
 * @param {object[]} catalogLabs
 */
async function fetchLabDefinition(api, labId, catalogLabs) {
  const fallback = catalogLabs.find((l) => l.id === labId) ?? { id: labId, title: labId }
  if (!api?.labs?.get) return fallback
  try {
    const res = await api.labs.get(labId)
    return res?.ok && res.data?.id ? res.data : fallback
  } catch {
    return fallback
  }
}

/**
 * @param {{ lab: object }} props
 */
function LabCard({ lab, dockerReady, starting, onDetails, onStart, developerMode = false }) {
  const bucket = labStatusBucket(lab)
  const progression = labProgressionBucket(lab)
  const isLocked = progression === 'locked'
  const isCompleted = progression === 'completed'
  const statusVariant = isLocked
    ? 'warning'
    : bucket === 'invalid'
      ? 'danger'
      : bucket === 'ready'
        ? 'success'
        : 'warning'
  const statusValue = isLocked
    ? 'Locked'
    : isCompleted
      ? 'Completed'
      : progression === 'in_progress'
        ? 'In progress'
        : bucket === 'invalid'
          ? 'Invalid'
          : bucket === 'ready'
            ? 'Ready'
            : 'Scaffold'
  const unlockLines = isLocked ? formatUnlockRequirements(lab) : []
  const tone = difficultyTone(lab.difficulty)
  const difficultyClass =
    tone === 'easy'
      ? 'text-success'
      : tone === 'medium'
        ? 'text-warning'
        : tone === 'hard'
          ? 'text-danger'
          : tone === 'expert'
            ? 'text-orange-400'
            : 'text-muted'

  const isCommunityDefinition =
    lab.source === 'community' && lab.valid && !lab.runnable && bucket === 'scaffold'
  const cardWarnings = developerMode ? (lab.warnings ?? []) : []
  const canStart = dockerReady && lab.valid && lab.runnable && !isLocked
  const startDisabled = !canStart || starting
  const sourceLabel =
    lab.source === 'online'
      ? 'Installed'
      : lab.source === 'community'
        ? 'Community'
        : lab.bundled === true || lab.source === 'bundled'
          ? 'Bundled'
          : null

  return (
    <Card
      padding="none"
      className={cn(
        'group relative z-0 flex h-full flex-col overflow-hidden transition-shadow duration-300',
        !isLocked && 'hover:z-[1] hover:border-accent/35 hover:shadow-glow',
        bucket === 'invalid' && 'border-danger/35 opacity-95',
        isLocked && 'border-border/80 opacity-80 saturate-[0.85]'
      )}
    >
      <div
        className="relative flex h-24 shrink-0 items-center justify-center border-b border-border/50"
        style={labThumbnailStyle(lab.id, lab.category)}
      >
        {isLocked ? (
          <span
            className="absolute left-3 top-3 text-lg"
            title="Complete earlier labs to unlock this challenge."
            aria-hidden
          >
            🔒
          </span>
        ) : null}
        <span className="text-2xl font-bold tracking-wide text-white/90 drop-shadow">{labInitials(lab.title)}</span>
        <span
          className="absolute right-3 top-3 text-xl opacity-90 transition-transform duration-300 group-hover:scale-110"
          title={lab.runtime}
        >
          {runtimeIcon(lab.runtime)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-dim">{lab.category}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {sourceLabel ? (
                <span className="rounded bg-background-elevated px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                  {sourceLabel}
                </span>
              ) : null}
              <span className={cn('text-[10px] font-semibold uppercase tracking-wide', difficultyClass)}>
                {lab.difficulty}
              </span>
            </div>
            <h3 className="mt-0.5 truncate font-medium text-white">{lab.title}</h3>
          </div>
          <StatusBadge
            label="Status"
            value={statusValue}
            variant={statusVariant}
            pulse={bucket === 'ready'}
            className="shrink-0"
          />
        </div>

        <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{lab.description}</p>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-dim">
          <span>{estimatedMinutesForDifficulty(lab.difficulty)}</span>
          <span aria-hidden="true">·</span>
          <span>{lab.hintCount ?? 0} hints</span>
          <span aria-hidden="true">·</span>
          <span className="text-accent">{lab.xpReward ?? 0} XP</span>
        </div>

        {!lab.valid && lab.errors?.length ? (
          <p className="mt-3 rounded-lg border border-danger/25 bg-danger/5 px-2.5 py-1.5 text-xs text-danger">
            {lab.errors[0]}
          </p>
        ) : null}

        {isCommunityDefinition ? (
          <p className="mt-3 rounded-lg border border-border/60 bg-background-elevated/50 px-2.5 py-1.5 text-xs text-muted">
            Definition only — browse objectives or download from Online Labs when a pack is available.
          </p>
        ) : null}

        {cardWarnings.length > 0 ? (
          <p className="mt-3 rounded-lg border border-warning/25 bg-warning/5 px-2.5 py-1.5 text-xs text-warning">
            {cardWarnings[0]}
          </p>
        ) : null}

        {isLocked && unlockLines.length > 0 ? (
          <div
            className="mt-3 max-h-[4.5rem] overflow-hidden rounded-lg border border-warning/20 bg-warning/5 px-2.5 py-2 text-xs text-muted"
            title={[...unlockLines, 'Open Details for full unlock requirements.'].join('\n')}
          >
            {unlockLines.slice(0, 3).map((line, i) => (
              <p key={i} className={line.startsWith('-') ? 'truncate pl-2' : 'truncate font-medium text-warning'}>
                {line.startsWith('-') || line.startsWith('Complete:') || line.startsWith('Achievements:')
                  ? line
                  : `🔒 ${line}`}
              </p>
            ))}
            {unlockLines.length > 3 ? (
              <p className="mt-1 text-[10px] text-muted-dim">+{unlockLines.length - 3} more — see Details</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <Button
            variant="primary"
            size="sm"
            disabled={startDisabled}
            title={isLocked ? 'Complete earlier labs to unlock this challenge.' : undefined}
            onClick={() => onStart(lab.id)}
          >
            {starting ? 'Deploying…' : isLocked ? 'Locked' : 'Deploy lab'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onDetails(lab)}>
            Details
          </Button>
        </div>
      </div>
    </Card>
  )
}

/**
 * @param {{ onNavigate: (id: string) => void }} props
 */
export default function Labs({ onNavigate }) {
  const { dockerReady, profile } = useAppState()
  const { notify } = useNotifications()
  const [loading, setLoading] = useState(true)
  const [labs, setLabs] = useState([])
  const [summary, setSummary] = useState({
    count: 0,
    validCount: 0,
    runnableCount: 0,
    invalidCount: 0
  })
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('all')
  const [category, setCategory] = useState('all')
  const [runtime, setRuntime] = useState('all')
  const [status, setStatus] = useState('all')
  const [progressionFilter, setProgressionFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('default')
  const [hideInvalid, setHideInvalid] = useState(false)
  const [hideCommunityDefinitions, setHideCommunityDefinitions] = useState(true)
  const [detailLab, setDetailLab] = useState(null)
  const [startingId, setStartingId] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [activeLab, setActiveLab] = useState(null)
  const [stoppingLab, setStoppingLab] = useState(false)
  const [cleanupIncomplete, setCleanupIncomplete] = useState(null)
  const [startNoticeOpen, setStartNoticeOpen] = useState(false)
  const [startNoticeDontShow, setStartNoticeDontShow] = useState(false)
  const [pendingStartLabId, setPendingStartLabId] = useState(null)
  const [workstationModal, setWorkstationModal] = useState({ open: false, labId: null, title: null })
  const [incidentBriefing, setIncidentBriefing] = useState({
    open: false,
    labId: null,
    title: null,
    workstationPreference: 'auto',
    deployment: null
  })
  const [lastWorkstationPreference, setLastWorkstationPreference] = useState('auto')
  const [startupUi, setStartupUi] = useState({
    open: false,
    labId: null,
    labTitle: null,
    sessionId: null,
    phase: 'running',
    step: 'prepare',
    message: 'Preparing lab…',
    percent: 0,
    status: 'running',
    logs: [],
    startedAt: null,
    errorMessage: null,
    failedStep: null,
    developerDetails: null,
    preservedContainers: false,
    pendingSession: null,
    workstationName: null,
    readinessState: null,
    desktopUrl: null,
    windowsInstalling: false,
    setupLogTail: []
  })
  const [recoverableDesktopSetups, setRecoverableDesktopSetups] = useState([])
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false)
  const [importingLabPack, setImportingLabPack] = useState(false)
  const [importConfirm, setImportConfirm] = useState(null)
  const [sessionRestoreAttempted, setSessionRestoreAttempted] = useState(false)
  const labsPageRef = useRef(null)

  const scrollLabsPageToTop = useCallback(() => {
    labsPageRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const focusActiveLab = useCallback(
    async (session, labId) => {
      const api = getApi()
      const labMeta = await fetchLabDefinition(api, labId, labs)
      const meta = labs.find((l) => l.id === labId) ?? { id: labId, title: labId, xpReward: 0 }
      setActiveSession(session)
      setActiveLab(labMeta?.objectives?.length ? labMeta : meta)
      setDetailLab(null)
      scrollLabsPageToTop()
    },
    [labs, scrollLabsPageToTop]
  )

  const restoreActiveSession = useCallback(async (catalogLabs) => {
    const api = getApi()
    if (!api?.labs?.listActiveSessions) return false
    try {
      const result = await api.labs.listActiveSessions()
      if (!result?.ok) return false
      const running = result.data?.sessions ?? []
      if (!running.length) return false

      const latest = running[0]
      if (!latest?.sessionId || !latest?.labId) return false

      let session = latest
      if (api.labs.getSessionState) {
        const fresh = await api.labs.getSessionState(latest.sessionId)
        if (fresh?.ok && fresh.data?.sessionId) {
          session = fresh.data
        }
      }

      setActiveSession((prev) => (prev?.sessionId ? prev : session))
      const labMeta = await fetchLabDefinition(api, latest.labId, catalogLabs)
      setActiveLab((prev) => {
        if (prev?.id === latest.labId && (prev?.objectivesPublic?.length || prev?.objectives?.length)) {
          return prev
        }
        return labMeta
      })
      scrollLabsPageToTop()
      return true
    } catch (err) {
      devLog('labs', 'Failed to restore active session', err)
      return false
    }
  }, [scrollLabsPageToTop])

  const developerMode = profile?.settings?.developerMode === true

  const loadLabs = useCallback(async () => {
    const api = getApi()
    if (!api?.labs?.list) {
      setError('Lab API unavailable')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await api.labs.list()
      if (!result.ok) {
        setError(result.error?.message ?? 'Failed to load labs')
        return
      }
      setLabs(result.data.labs ?? [])
      setSummary({
        count: result.data.count ?? 0,
        validCount: result.data.validCount ?? 0,
        runnableCount: result.data.runnableCount ?? 0,
        invalidCount:
          result.data.invalidCount ??
          (result.data.labs?.filter((l) => !l.valid).length ?? 0)
      })
      devLog('labs', 'Loaded lab catalog', result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load labs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLabs()
    const api = getApi()
    void api?.labs?.listRecoverableDesktopSetups?.().then((result) => {
      if (result?.ok && Array.isArray(result.data) && result.data.length > 0) {
        setRecoverableDesktopSetups(result.data)
        setRecoveryModalOpen(true)
      }
    })
  }, [profile?.level, profile?.xp, loadLabs])

  useEffect(() => {
    if (loading || sessionRestoreAttempted) return
    void (async () => {
      const restored = await restoreActiveSession(labs)
      setSessionRestoreAttempted(true)
      if (restored) {
        devLog('labs', 'Restored active lab session after navigation')
      }
    })()
  }, [loading, labs, restoreActiveSession, sessionRestoreAttempted])

  useEffect(() => {
    const api = getApi()
    void api?.discord?.updatePresence?.({ page: 'labs' })
  }, [])

  const categories = useMemo(() => uniqueCategories(labs), [labs])
  const runtimes = useMemo(() => uniqueRuntimes(labs), [labs])

  const filtered = useMemo(
    () =>
      sortLabs(
        filterLabs(labs, {
          search,
          difficulty,
          category,
          runtime,
          status,
          progression: progressionFilter,
          source: sourceFilter,
          hideInvalid,
          hideCommunityDefinitions
        }),
        sortBy
      ),
    [labs, search, difficulty, category, runtime, status, progressionFilter, sourceFilter, hideInvalid, hideCommunityDefinitions, sortBy]
  )

  const resetFilters = useCallback(() => {
    setSearch('')
    setDifficulty('all')
    setCategory('all')
    setRuntime('all')
    setStatus('all')
    setProgressionFilter('all')
    setSourceFilter('all')
    setSortBy('default')
    setHideInvalid(false)
    setHideCommunityDefinitions(true)
  }, [])

  const importLabPack = useCallback(
    async (confirmUnverified = false) => {
      const api = getApi()
      if (!api?.labs?.importLabPack) return
      setImportingLabPack(true)
      try {
        const res = await api.labs.importLabPack({ confirmUnverified })
        if (res?.error?.code === 'CANCELLED') return
        if (res?.data?.needsConfirmation) {
          setImportConfirm({
            labId: res.data.labId,
            warning: res.data.warning ?? 'This lab pack is not cryptographically signed.'
          })
          return
        }
        if (res?.ok && res.data?.ok !== false) {
          setImportConfirm(null)
          notify({
            title: res.data?.verified ? 'Lab pack installed' : 'Lab pack imported',
            body:
              res.data?.warning ??
              `${res.data?.labId ?? 'Lab'} is ready in your local lab list.`,
            tone: res.data?.verified ? 'success' : 'warning'
          })
          await loadLabs()
        } else {
          notify({
            title: 'Import failed',
            body: res?.error?.message ?? res?.data?.verification?.message ?? 'Unknown error',
            tone: 'danger'
          })
        }
      } catch (e) {
        notify({ title: 'Import failed', body: String(e), tone: 'danger' })
      } finally {
        setImportingLabPack(false)
      }
    },
    [loadLabs, notify]
  )

  const openWorkstationPicker = useCallback((labId) => {
    const labMeta = labs.find((l) => l.id === labId)
    setWorkstationModal({
      open: true,
      labId,
      title: labMeta?.title ?? labId
    })
  }, [labs])

  const labNeedsWorkstationPicker = useCallback(
    (labId) => {
      const labMeta = labs.find((l) => l.id === labId)
      if (!labMeta) return true
      // Match main-process labRequiresWorkstationSelection: only target-only skips the picker.
      return labMeta.labMode !== 'target-only'
    },
    [labs]
  )

  const deployMission = useCallback(
    async (labId, workstationPreference = 'auto', isoPath = null, deployment = null, startExtras = null) => {
      const api = getApi()
      if (!api?.labs?.start) return

      const targetOnly = startExtras?.targetOnly === true
      const pref =
        targetOnly || workstationPreference == null
          ? null
          : typeof workstationPreference === 'string' && workstationPreference.trim()
            ? workstationPreference.trim()
            : 'auto'
      if (pref) setLastWorkstationPreference(pref)

      const labMeta = labs.find((l) => l.id === labId) ?? { id: labId, title: labId }
      setStartingId(labId)
      setStartupUi({
        open: true,
        labId,
        labTitle: labMeta.title,
        sessionId: null,
        phase: 'running',
        step: 'prepare',
        message: 'Preparing lab session…',
        percent: 5,
        status: 'running',
        logs: [{ step: 'prepare', message: 'Preparing lab session…', status: 'running' }],
        startedAt: Date.now(),
        errorMessage: null,
        failedStep: null,
        developerDetails: null,
        preservedContainers: false,
        pendingSession: null,
        workstationName: null,
        readinessState: null,
        desktopUrl: null,
        windowsInstalling: false,
        setupLogTail: []
      })

      const unsub = api.labs.onStartProgress?.((payload) => {
        setStartupUi((prev) => {
          const entry = {
            step: payload.step,
            message: payload.message,
            status: payload.status,
            at: payload.at
          }
          const logs = [...prev.logs]
          const last = logs[logs.length - 1]
          if (last?.step === entry.step && last?.status === 'running' && entry.status !== 'running') {
            logs[logs.length - 1] = entry
          } else if (
            !last ||
            last.step !== entry.step ||
            last.status !== entry.status ||
            last.message !== entry.message
          ) {
            logs.push(entry)
          }
          return {
            ...prev,
            sessionId: payload.sessionId ?? prev.sessionId,
            step: payload.step,
            message: payload.message,
            percent: payload.percent ?? prev.percent,
            status: payload.status ?? prev.status,
            workstationName:
              payload.step === 'desktop_readiness'
                ? (prev.workstationName ?? 'Desktop Workstation')
                : prev.workstationName,
            readinessState:
              payload.step === 'desktop_readiness'
                ? (payload.readinessState ?? prev.readinessState)
                : prev.readinessState,
            desktopUrl:
              payload.step === 'desktop_readiness' && payload.desktopUrl
                ? payload.desktopUrl
                : prev.desktopUrl,
            windowsInstalling:
              payload.step === 'desktop_readiness'
                ? payload.windowsInstalling === true
                : prev.windowsInstalling,
            setupLogTail:
              payload.step === 'desktop_readiness' && Array.isArray(payload.setupLogTail)
                ? payload.setupLogTail
                : prev.setupLogTail,
            logs: logs.slice(-50)
          }
        })
      })

      try {
        const startPayload = {
          workstationPreference: pref ?? 'auto'
        }
        const result = await api.labs.start(labId, startPayload)
        if (result.ok) {
          const data = result.data
          setStartupUi((prev) => ({
            ...prev,
            open: true,
            phase: 'ready',
            step: 'ready',
            status: 'success',
            message:
              data?.message ??
              'Lab environment is ready. Click Start lab when you are ready to begin.',
            percent: 100,
            sessionId: data.sessionId ?? prev.sessionId,
            pendingSession: data,
            logs: [
              ...prev.logs,
              {
                step: 'ready',
                message: 'Lab environment is ready.',
                status: 'success'
              }
            ]
          }))
        } else if (result.error?.code === 'MISSION_START_CANCELED') {
          setStartupUi((prev) => ({
            ...prev,
            open: true,
            phase: 'canceled',
            status: 'warning',
            message: 'Lab start canceled.'
          }))
        } else {
          setStartupUi((prev) => ({
            ...prev,
            open: true,
            phase: 'failed',
            status: 'error',
            errorMessage: result.error?.message ?? 'Lab could not be deployed.',
            failedStep: result.error?.failedStep ?? prev.step,
            sessionId: result.error?.sessionId ?? prev.sessionId,
            developerDetails: result.error?.developerDetails ?? null,
            preservedContainers: result.error?.preservedContainers === true
          }))
        }
      } catch (e) {
        setStartupUi((prev) => ({
          ...prev,
          open: true,
          phase: 'failed',
          status: 'error',
          errorMessage: e instanceof Error ? e.message : 'Request failed',
          failedStep: prev.step
        }))
      } finally {
        unsub?.()
        setStartingId(null)
      }
    },
    [labs, lastWorkstationPreference]
  )

  const handleEnterLabFromStartup = useCallback(async () => {
    const pending = startupUi.pendingSession
    const labId = startupUi.labId ?? pending?.labId
    if (!pending?.sessionId || !labId) return

    const api = getApi()
    let session = pending
    if (pending.activated !== true && api?.labs?.enterSession) {
      const result = await api.labs.enterSession(pending.sessionId)
      if (!result?.ok) {
        notify({
          title: 'Could not start lab',
          body: result?.error?.message ?? 'Session activation failed.',
          tone: 'danger'
        })
        return
      }
      session = result.data
    }

    setStartupUi((prev) => ({ ...prev, open: false, pendingSession: null }))
    await focusActiveLab(session, labId)
    const meta = labs.find((l) => l.id === labId)
    notify({
      title: 'Lab started',
      body: `${meta?.title ?? labId} is active. Use the session panel below for access and objectives.`,
      tone: 'success'
    })
  }, [startupUi.pendingSession, startupUi.labId, labs, notify, focusActiveLab])

  const queueDeployOrBriefing = useCallback(
    (labId, workstationPreference = 'auto', deployment = null) => {
      const labMeta = labs.find((l) => l.id === labId)
      if (labMeta?.hasTicket) {
        setIncidentBriefing({
          open: true,
          labId,
          title: labMeta.title ?? labId,
          workstationPreference,
          deployment
        })
        return
      }
      void deployMission(labId, workstationPreference, null, deployment)
    },
    [labs, deployMission]
  )

  const beginLabStart = useCallback(
    (labId) => {
      if (labNeedsWorkstationPicker(labId)) {
        openWorkstationPicker(labId)
        return
      }
      queueDeployOrBriefing(labId, 'auto')
    },
    [labNeedsWorkstationPicker, openWorkstationPicker, queueDeployOrBriefing]
  )

  const dismissStartupModal = useCallback(() => {
    setStartupUi((prev) => ({ ...prev, open: false }))
  }, [])

  const handleCancelStartup = useCallback(async () => {
    const api = getApi()
    const sessionId = startupUi.sessionId
    const labId = startupUi.labId
    if (!sessionId || !labId) return
    await api?.labs?.cancelStart?.(sessionId, labId)
  }, [startupUi.sessionId, startupUi.labId])

  const handleForceStartFromStartup = useCallback(async () => {
    const api = getApi()
    const sessionId = startupUi.sessionId
    if (!sessionId || !api?.labs?.forceDesktopReady) {
      throw new Error('Desktop setup is not ready to continue yet.')
    }
    const result = await api.labs.forceDesktopReady(sessionId)
    if (!result?.ok) {
      const message = result?.error?.message ?? 'Desktop setup is not ready to continue yet.'
      notify({
        title: 'Could not continue',
        body: message,
        tone: 'warning'
      })
      throw new Error(message)
    }
  }, [startupUi.sessionId, notify])

  const resumeDesktopSetup = useCallback(
    async (sessionId) => {
      const api = getApi()
      if (!sessionId || !api?.labs?.resumeDesktopSetup) return
      const setup = recoverableDesktopSetups.find((row) => row.sessionId === sessionId)
      setRecoveryModalOpen(false)
      setStartupUi({
        open: true,
        labId: setup?.labId ?? null,
        labTitle: labs.find((l) => l.id === setup?.labId)?.title ?? setup?.labId ?? 'Lab',
        sessionId,
        phase: 'running',
        step: 'desktop_readiness',
        message: 'Resuming desktop setup…',
        percent: 88,
        status: 'running',
        logs: [{ step: 'desktop_readiness', message: 'Resuming desktop setup…', status: 'running' }],
        startedAt: setup?.readinessStartedAt ?? Date.now(),
        errorMessage: null,
        failedStep: null,
        developerDetails: null,
        preservedContainers: false,
        pendingSession: null,
        workstationName: setup?.workstationProfileName ?? 'Desktop workstation',
        readinessState: null,
        desktopUrl: null,
        windowsInstalling: true,
        setupLogTail: []
      })

      const unsub = api.labs.onStartProgress?.((payload) => {
        if (payload.sessionId && payload.sessionId !== sessionId) return
        setStartupUi((prev) => {
          const entry = {
            step: payload.step,
            message: payload.message,
            status: payload.status,
            at: payload.at
          }
          const logs = [...prev.logs]
          const last = logs[logs.length - 1]
          if (last?.step === entry.step && last?.status === 'running' && entry.status !== 'running') {
            logs[logs.length - 1] = entry
          } else if (
            !last ||
            last.step !== entry.step ||
            last.status !== entry.status ||
            last.message !== entry.message
          ) {
            logs.push(entry)
          }
          return {
            ...prev,
            step: payload.step,
            message: payload.message,
            percent: payload.percent ?? prev.percent,
            status: payload.status ?? prev.status,
            readinessState:
              payload.step === 'desktop_readiness'
                ? (payload.readinessState ?? prev.readinessState)
                : prev.readinessState,
            desktopUrl:
              payload.step === 'desktop_readiness' && payload.desktopUrl
                ? payload.desktopUrl
                : prev.desktopUrl,
            windowsInstalling:
              payload.step === 'desktop_readiness'
                ? payload.windowsInstalling === true
                : prev.windowsInstalling,
            setupLogTail:
              payload.step === 'desktop_readiness' && Array.isArray(payload.setupLogTail)
                ? payload.setupLogTail
                : prev.setupLogTail,
            logs: logs.slice(-50)
          }
        })
      })

      try {
        const result = await api.labs.resumeDesktopSetup(sessionId)
        if (result.ok) {
          const data = result.data
          setRecoverableDesktopSetups((prev) => prev.filter((row) => row.sessionId !== sessionId))
          setStartupUi((prev) => ({
            ...prev,
            open: true,
            phase: 'ready',
            step: 'ready',
            status: 'success',
            message:
              data?.message ?? 'Desktop setup complete. Click Start lab when you are ready.',
            percent: 100,
            sessionId: data.sessionId ?? sessionId,
            labId: data.labId ?? prev.labId,
            pendingSession: data,
            logs: [
              ...prev.logs,
              {
                step: 'ready',
                message: 'Desktop setup complete.',
                status: 'success'
              }
            ]
          }))
        } else {
          setStartupUi((prev) => ({
            ...prev,
            phase: 'failed',
            status: 'error',
            errorMessage: result.error?.message ?? 'Could not resume desktop setup.',
            failedStep: 'desktop_readiness'
          }))
        }
      } catch (e) {
        setStartupUi((prev) => ({
          ...prev,
          phase: 'failed',
          status: 'error',
          errorMessage: e instanceof Error ? e.message : 'Request failed',
          failedStep: 'desktop_readiness'
        }))
      } finally {
        unsub?.()
      }
    },
    [labs, notify, recoverableDesktopSetups]
  )

  const handleRetryStartup = useCallback(() => {
    if (!startupUi.labId) return
    dismissStartupModal()
    void deployMission(startupUi.labId, lastWorkstationPreference)
  }, [startupUi.labId, lastWorkstationPreference, deployMission, dismissStartupModal])

  const handleCleanupStartup = useCallback(async () => {
    const api = getApi()
    if (startupUi.sessionId && startupUi.labId) {
      if (startupUi.preservedContainers && api?.labs?.cleanupFailedStartup) {
        await api.labs.cleanupFailedStartup(startupUi.sessionId, startupUi.labId)
      } else {
        await api?.labs?.cancelStart?.(startupUi.sessionId, startupUi.labId)
      }
    }
    dismissStartupModal()
  }, [startupUi.sessionId, startupUi.labId, startupUi.preservedContainers, dismissStartupModal])

  const handleStart = useCallback(
    async (labId) => {
      const api = getApi()
      if (!api?.labs?.start) return

      const labMeta = labs.find((l) => l.id === labId)
      if (labMeta?.locked) {
        notify({
          title: 'Lab locked',
          body: labMeta.unlockSummary ?? 'Complete earlier labs to unlock this challenge.',
          tone: 'warning'
        })
        return
      }

      if (profile?.settings?.disclaimerAccepted !== true) {
        notify({
          title: 'Disclaimer required',
          body: GAME_UI.disclaimerRequired,
          tone: 'warning'
        })
        onNavigate?.('settings')
        return
      }

      const requireWarning = profile?.settings?.requireLabStartWarning !== false
      if (requireWarning) {
        setPendingStartLabId(labId)
        setStartNoticeDontShow(false)
        setStartNoticeOpen(true)
        return
      }

      beginLabStart(labId)
    },
    [
      notify,
      labs,
      onNavigate,
      profile?.settings?.disclaimerAccepted,
      profile?.settings?.requireLabStartWarning,
      beginLabStart
    ]
  )

  const confirmStart = useCallback(async () => {
    const api = getApi()
    const labId = pendingStartLabId
    setStartNoticeOpen(false)
    setPendingStartLabId(null)
    if (!labId) return
    if (startNoticeDontShow) {
      await api?.settings?.set?.({ requireLabStartWarning: false })
    }
    beginLabStart(labId)
  }, [pendingStartLabId, startNoticeDontShow, beginLabStart])

  const handleWorkstationConfirm = useCallback(
    (workstationPreference, deployment) => {
      const labId = workstationModal.labId
      if (!labId) return
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[deployment] starting', workstationPreference, { labId })
      }
      setWorkstationModal({ open: false, labId: null, title: null })
      queueDeployOrBriefing(labId, workstationPreference, deployment)
    },
    [workstationModal.labId, queueDeployOrBriefing]
  )

  const handleStartInvestigation = useCallback(() => {
    const { labId, workstationPreference, deployment } = incidentBriefing
    setIncidentBriefing({
      open: false,
      labId: null,
      title: null,
      workstationPreference: 'auto',
      deployment: null
    })
    if (labId) void deployMission(labId, workstationPreference, null, deployment)
  }, [incidentBriefing, deployMission])

  const handleStopSession = useCallback(async () => {
    if (!activeSession?.sessionId || stoppingLab) return
    const confirmed = window.confirm(
      'Stopping this lab will delete unsaved progress for this attempt.'
    )
    if (!confirmed) return
    const api = getApi()
    if (!api?.labs?.stop) return
    const sessionId = activeSession.sessionId
    setStoppingLab(true)
    try {
      const result = await api.labs.stop(sessionId)
      if (result.ok) {
        const data = result.data ?? {}
        const cleanupOk = data.verified === true || data.status === 'stopped'
        if (cleanupOk) {
          try {
            sessionStorage.removeItem(`sgq-lab-terminal-intro-${sessionId}`)
          } catch {
            // ignore
          }
          setActiveSession(null)
          setActiveLab(null)
          setCleanupIncomplete(null)
          notify({
            title: 'Lab ended',
            body: data.message ?? 'Temporary progress and environment removed.',
            tone: 'info'
          })
        } else {
          setCleanupIncomplete({ sessionId, cleanup: data.cleanup ?? null })
          notify({
            title: 'Cleanup incomplete',
            body: 'Some lab Docker resources could not be removed. Use Retry cleanup or Force cleanup.',
            tone: 'warning'
          })
        }
      } else {
        notify({ title: 'Stop failed', body: result.error?.message ?? 'Unknown error', tone: 'danger' })
      }
    } catch (e) {
      notify({ title: 'Stop failed', body: e instanceof Error ? e.message : 'Request failed', tone: 'danger' })
    } finally {
      setStoppingLab(false)
    }
  }, [activeSession, notify, stoppingLab])

  const handleClearSession = useCallback(() => {
    setActiveSession(null)
    setActiveLab(null)
  }, [])

  const handleResetSession = useCallback(async () => {
    if (!activeSession?.sessionId) return
    const api = getApi()
    if (!api?.labs?.reset) return
    try {
      const result = await api.labs.reset(activeSession.sessionId)
      if (result.ok) {
        setActiveSession(result.data)
        notify({
          title: 'Lab reset',
          body: result.data?.message ?? 'Container recreated for this session.',
          tone: 'info'
        })
      } else {
        notify({ title: 'Reset failed', body: result.error?.message ?? 'Unknown error', tone: 'danger' })
      }
    } catch (e) {
      notify({ title: 'Reset failed', body: e instanceof Error ? e.message : 'Request failed', tone: 'danger' })
    }
  }, [activeSession, notify])

  const showFilteredEmpty = !loading && labs.length > 0 && filtered.length === 0
  const inActiveLab = Boolean(activeSession?.sessionId)
  const hideLabBrowser =
    inActiveLab || startupUi.open || workstationModal.open || incidentBriefing.open
  const showLabsPageChrome =
    !startupUi.open && !workstationModal.open && !incidentBriefing.open

  return (
    <div ref={labsPageRef} className="mx-auto w-full max-w-6xl space-y-6 px-0">
      <Modal
        open={startNoticeOpen}
        onClose={() => {
          setStartNoticeOpen(false)
          setPendingStartLabId(null)
        }}
        title="Safety notice"
        size="md"
      >
        <div className="space-y-4 px-6 py-5 text-sm text-muted">
          <p className="text-gray-200">
            This lab runs inside a {GAME_UI.sandboxMissionEnv} managed by {GAME_UI.appName}. Do not run
            commands on your real system unless you understand them.
          </p>
          <label className="flex items-start gap-3 rounded-lg border border-border bg-background-elevated/60 p-3">
            <input
              type="checkbox"
              checked={startNoticeDontShow}
              onChange={(e) => setStartNoticeDontShow(e.target.checked)}
              className="mt-1 rounded border-border text-accent focus:ring-accent/40"
            />
            <span className="text-gray-200">Don&apos;t show again</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" size="sm" onClick={() => setStartNoticeOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void confirmStart()}>
            Deploy lab
          </Button>
        </div>
      </Modal>
      {showLabsPageChrome ? (
        <SectionTitle
          eyebrow="Labs"
          title={
            inActiveLab
              ? activeLab?.title ?? activeSession?.labId ?? GAME_UI.mission
              : GAME_UI.missionBrowser
          }
          description={
            inActiveLab
              ? 'Your active lab session. End the lab below to return to the lab browser.'
              : 'Search and filter community labs. Deploy when your lab systems are online.'
          }
          action={
            inActiveLab ? null : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void importLabPack()}
                  disabled={importingLabPack}
                >
                  {importingLabPack ? 'Importing…' : 'Import lab pack'}
                </Button>
                <Button variant="secondary" size="sm" onClick={loadLabs} disabled={loading}>
                  Refresh
                </Button>
              </div>
            )
          }
        />
      ) : null}

      {showLabsPageChrome && !hideLabBrowser ? <DockerOnboarding onNavigate={onNavigate} /> : null}

      {importConfirm && !inActiveLab ? (
        <Card className="border-warning/50 bg-warning/10">
          <p className="text-sm text-warning">{importConfirm.warning}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void importLabPack(true)}>
              I understand — install anyway
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setImportConfirm(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {stoppingLab ? (
        <Card className="border-accent/30 bg-accent/5">
          <p className="text-sm font-medium text-accent">Ending lab…</p>
          <p className="mt-1 text-sm text-muted">
            Stopping containers and removing temporary resources. This may take a moment.
          </p>
        </Card>
      ) : null}

      {activeSession ? (
        <LabSessionPanel
          session={activeSession}
          lab={activeLab ?? { id: activeSession.labId, title: activeSession.labId }}
          stopping={stoppingLab}
          onSessionUpdate={setActiveSession}
          onClose={() => {
            void handleStopSession()
          }}
          onStop={handleStopSession}
          onReset={handleResetSession}
          onComplete={handleClearSession}
        />
      ) : null}

      {!hideLabBrowser ? (
        <>
      {!dockerReady && !loading && labs.length > 0 ? (
        <Card className="border-warning/25 bg-warning/5">
          <p className="text-sm font-medium text-warning">Docker required</p>
          <p className="mt-1 text-sm text-muted">
            Labs need a local Docker deployment engine running. Run Health Checks to bring lab systems online before
            deploying.
          </p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={() => onNavigate('tools')}>
            Open Health Checks
          </Button>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-danger/30">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      ) : null}

      {!loading && labs.length > 0 ? (
        <Card className="space-y-4 border-border/80">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="lab-search" className="text-xs font-medium text-muted-dim">
                Search labs
              </label>
              <input
                id="lab-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title, description, id, tags…"
                className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm text-white placeholder:text-muted-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
            </div>
            <Button variant="ghost" size="sm" className="shrink-0 self-start lg:self-end" onClick={resetFilters}>
              Reset filters
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <div>
              <label className="text-xs text-muted-dim">Pack</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-2 py-2 text-sm text-white"
              >
                <option value="all">All packs</option>
                <option value="bundled">Bundled</option>
                <option value="community">Community examples</option>
                <option value="online">Installed community</option>
                <option value="installed">Community + installed</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-dim">Progress</label>
              <select
                value={progressionFilter}
                onChange={(e) => setProgressionFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-2 py-2 text-sm text-white"
              >
                <option value="all">All</option>
                <option value="available">Available</option>
                <option value="locked">Locked</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-dim">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-2 py-2 text-sm text-white"
              >
                <option value="all">All</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
                <option value="Expert">Expert</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-dim">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-2 py-2 text-sm text-white"
              >
                <option value="all">All</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-dim">Runtime</label>
              <select
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-2 py-2 text-sm text-white"
              >
                <option value="all">All</option>
                {runtimes.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-dim">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-2 py-2 text-sm text-white"
              >
                <option value="all">All</option>
                <option value="ready">Ready</option>
                <option value="scaffold">Scaffold</option>
                <option value="invalid">Invalid</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-dim">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-2 py-2 text-sm text-white"
              >
                <option value="default">Progression (unlock order)</option>
                <option value="title">Title A–Z</option>
                <option value="xp-desc">XP (high → low)</option>
                <option value="xp-asc">XP (low → high)</option>
                <option value="difficulty">Difficulty</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={hideInvalid}
              onChange={(e) => setHideInvalid(e.target.checked)}
              className="rounded border-border text-accent focus:ring-accent/40"
            />
            Hide invalid labs
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={hideCommunityDefinitions}
              onChange={(e) => setHideCommunityDefinitions(e.target.checked)}
              className="rounded border-border text-accent focus:ring-accent/40"
            />
            Hide community definitions (not yet deployable)
          </label>

          {summary.invalidCount > 0 && hideInvalid ? (
            <p className="text-xs text-muted-dim">Invalid labs are hidden from this list ({summary.invalidCount} total).</p>
          ) : null}
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : summary.count === 0 ? (
        <Card className="text-center sm:text-left">
          <p className="text-base font-medium text-white">No labs found</p>
          <p className="mt-2 text-sm text-muted">
            Add lab folders under <code className="text-accent">labs/</code> with a valid{' '}
            <code className="text-accent">lab.json</code> and Dockerfile.
          </p>
          <Button className="mt-4" variant="primary" size="sm" onClick={() => onNavigate('tools')}>
            Verify system setup
          </Button>
        </Card>
      ) : showFilteredEmpty ? (
        <Card className="border-border-muted">
          <p className="text-base font-medium text-white">No labs match your filters</p>
          <p className="mt-2 text-sm text-muted">Try clearing search or widening filters.</p>
          <Button className="mt-4" variant="secondary" size="sm" onClick={resetFilters}>
            Reset filters
          </Button>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-dim">
            Showing {filtered.length} of {summary.count} · {summary.validCount} valid · {summary.runnableCount}{' '}
            runnable
            {summary.invalidCount > 0 ? ` · ${summary.invalidCount} invalid` : ''}
            {!dockerReady ? ' · Systems offline' : ''}
          </p>
          <div className="grid auto-rows-fr items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((lab) => (
              <div key={lab.id} className="flex min-h-0 min-w-0">
                <LabCard
                  lab={lab}
                  dockerReady={dockerReady}
                  starting={startingId === lab.id}
                  onDetails={setDetailLab}
                  onStart={handleStart}
                  developerMode={developerMode}
                />
              </div>
            ))}
          </div>
        </>
      )}
        </>
      ) : null}

      <LabDetailModal
        open={Boolean(detailLab)}
        onClose={() => setDetailLab(null)}
        labSummary={detailLab}
        dockerReady={dockerReady}
        onStart={handleStart}
        starting={Boolean(detailLab && startingId === detailLab.id)}
      />

      <ChooseLabWorkstationModal
        open={workstationModal.open}
        labId={workstationModal.labId}
        labTitle={workstationModal.title}
        developerMode={developerMode}
        onClose={() => setWorkstationModal({ open: false, labId: null, title: null })}
        onConfirm={handleWorkstationConfirm}
      />

      <LabIncidentBriefingModal
        open={incidentBriefing.open}
        labId={incidentBriefing.labId}
        labTitle={incidentBriefing.title}
        onClose={() =>
          setIncidentBriefing({
            open: false,
            labId: null,
            title: null,
            workstationPreference: 'auto',
            deployment: null
          })
        }
        onStartInvestigation={handleStartInvestigation}
      />

      <MissionStartupModal
        open={startupUi.open}
        labTitle={startupUi.labTitle}
        phase={startupUi.phase}
        step={startupUi.step}
        message={startupUi.message}
        percent={startupUi.percent}
        status={startupUi.status}
        logs={startupUi.logs}
        startedAt={startupUi.startedAt}
        errorMessage={startupUi.errorMessage}
        failedStep={startupUi.failedStep}
        developerDetails={startupUi.developerDetails}
        showDeveloperDetails={developerMode || Boolean(startupUi.developerDetails)}
        preservedContainers={startupUi.preservedContainers}
        onCancel={handleCancelStartup}
        onRetry={handleRetryStartup}
        onCleanup={handleCleanupStartup}
        onStartLab={handleEnterLabFromStartup}
        onContinueToLab={handleForceStartFromStartup}
        onDismiss={dismissStartupModal}
        readinessState={startupUi.readinessState}
        desktopUrl={startupUi.desktopUrl}
        windowsInstalling={startupUi.windowsInstalling}
        workstationName={startupUi.workstationName}
        setupLogTail={startupUi.setupLogTail}
      />

      <DesktopSetupRecoveryModal
        open={recoveryModalOpen && recoverableDesktopSetups.length > 0}
        setups={recoverableDesktopSetups}
        onClose={() => setRecoveryModalOpen(false)}
        onResume={(sessionId) => void resumeDesktopSetup(sessionId)}
        onDiscard={(sessionId) => {
          setRecoverableDesktopSetups((prev) => prev.filter((row) => row.sessionId !== sessionId))
        }}
      />

      <LabCleanupIncompleteModal
        open={Boolean(cleanupIncomplete?.sessionId)}
        sessionId={cleanupIncomplete?.sessionId ?? null}
        cleanup={cleanupIncomplete?.cleanup ?? null}
        developerMode={developerMode}
        onDismiss={() => setCleanupIncomplete(null)}
        onResolved={() => {
          const sessionId = cleanupIncomplete?.sessionId
          if (sessionId) {
            try {
              sessionStorage.removeItem(`sgq-lab-terminal-intro-${sessionId}`)
            } catch {
              // ignore
            }
          }
          setActiveSession(null)
          setActiveLab(null)
          setCleanupIncomplete(null)
          notify({
            title: 'Lab ended',
            body: 'Temporary progress and environment removed.',
            tone: 'info'
          })
        }}
      />
    </div>
  )
}

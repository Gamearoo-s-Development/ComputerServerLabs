/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { Button } from '../ui/index.js'
import { cn } from '../../utils/cn.js'
import { formatReadinessStateLabel } from '@sysadmin-game/shared/workstations/desktopReadinessLogic.js'
import DesktopSetupPreview from './DesktopSetupPreview.jsx'

function formatElapsed(ms) {
  const sec = Math.floor(ms / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const FIRST_SETUP_NOTE =
  'This can take a while on first setup. Keep this window open. The lab timer has not started.'

/**
 * @param {{
 *   open: boolean
 *   labTitle?: string
 *   phase: 'running' | 'ready' | 'failed' | 'canceled'
 *   step?: string
 *   message?: string
 *   percent?: number
 *   status?: string
 *   logs?: { step: string, message: string, status: string, at?: string }[]
 *   startedAt?: number
 *   errorMessage?: string
 *   failedStep?: string
 *   developerDetails?: string
 *   showDeveloperDetails?: boolean
 *   preservedContainers?: boolean
 *   workstationName?: string | null
 *   onCancel?: () => void
 *   onRetry?: () => void
 *   onCleanup?: () => void
 *   onDismiss?: () => void
 *   onStartLab?: () => void
 *   onContinueToLab?: () => void | Promise<void>
 *   readinessState?: string | null
 *   desktopUrl?: string | null
 *   windowsInstalling?: boolean
 *   setupLogTail?: string[]
 * }} props
 */
export default function MissionStartupModal({
  open,
  labTitle,
  phase,
  step,
  message,
  percent = 0,
  status = 'running',
  logs = [],
  startedAt,
  errorMessage,
  failedStep,
  developerDetails,
  showDeveloperDetails = false,
  preservedContainers = false,
  workstationName,
  onCancel,
  onRetry,
  onCleanup,
  onDismiss,
  onStartLab,
  onContinueToLab,
  readinessState = null,
  desktopUrl = null,
  windowsInstalling = false,
  setupLogTail = []
}) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [continuingToLab, setContinuingToLab] = useState(false)

  const handleCopyDiagnostics = async () => {
    if (!developerDetails) return
    try {
      await navigator.clipboard.writeText(developerDetails)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!open || !startedAt || phase !== 'running') return undefined
    const tick = () => setElapsedMs(Date.now() - startedAt)
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [open, startedAt, phase])

  useEffect(() => {
    if (phase === 'failed' && showDeveloperDetails && developerDetails) {
      setDiagnosticsOpen(true)
    }
  }, [phase, showDeveloperDetails, developerDetails])

  useEffect(() => {
    if (!open || phase === 'running') return
    setContinuingToLab(false)
  }, [open, phase])

  const title = useMemo(() => {
    if (phase === 'failed') return 'Lab deployment failed'
    if (phase === 'canceled') return 'Lab start canceled'
    if (phase === 'ready') return labTitle ? `Ready: ${labTitle}` : 'Lab ready'
    if (phase === 'running' && step === 'desktop_readiness') {
      return 'Preparing Workstation'
    }
    return labTitle ? `Deploying: ${labTitle}` : 'Deploying lab…'
  }, [phase, labTitle, step])

  const isPreparingDesktop = phase === 'running' && step === 'desktop_readiness'
  const isReady = phase === 'ready'
  const showSetupPreview = isPreparingDesktop && (Boolean(desktopUrl) || setupLogTail.length > 0)
  const canCancel = phase === 'running' && status !== 'success'
  const canStartLab = isReady && typeof onStartLab === 'function'
  const canContinueToLab =
    isPreparingDesktop &&
    Boolean(desktopUrl) &&
    typeof onContinueToLab === 'function' &&
    status !== 'success'
  const readinessLabel = readinessState ? formatReadinessStateLabel(readinessState) : null
  const compactDesktopSetup = showSetupPreview && phase === 'running'
  const showModalFooter =
    canStartLab ||
    (canContinueToLab && !compactDesktopSetup) ||
    (canCancel && !compactDesktopSetup) ||
    phase === 'failed' ||
    phase === 'canceled' ||
    isReady

  const handleContinueToLab = async () => {
    if (!canContinueToLab || continuingToLab) return
    setContinuingToLab(true)
    try {
      await onContinueToLab?.()
    } catch {
      setContinuingToLab(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={isPreparingDesktop ? () => {} : onDismiss}
      title={title}
      size="lg"
      panelClassName={
        showSetupPreview
          ? '!max-w-xl flex max-h-[min(88dvh,42rem)] flex-col overflow-hidden'
          : 'max-w-xl'
      }
    >
      <div
        className={cn(
          'space-y-4 px-6 py-5',
          showSetupPreview && 'min-h-0 flex-1 overflow-y-auto'
        )}
      >
        {isPreparingDesktop && workstationName && !compactDesktopSetup ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">{workstationName}</p>
        ) : null}

        {showSetupPreview ? (
          <DesktopSetupPreview desktopUrl={desktopUrl} setupLogTail={setupLogTail} />
        ) : null}

        {isPreparingDesktop && !showSetupPreview ? (
          <>
            <p className="text-xs text-muted">
              {windowsInstalling
                ? 'Windows is still installing. Keep this window open — the lab timer has not started.'
                : FIRST_SETUP_NOTE}
            </p>
            <p className="text-xs text-muted-dim">Waiting for the desktop viewer to become available…</p>
          </>
        ) : null}

        {isReady ? (
          <div className="space-y-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-gray-200">
            <p className="font-medium text-success">Lab environment is set up</p>
            <p className="text-muted">
              {message ??
                'Containers are running and credentials are ready. Click Start lab to open the session panel and begin (the lab timer starts when you start).'}
            </p>
          </div>
        ) : null}

        {phase === 'running' ? (
          <>
            {!compactDesktopSetup ? (
              <p
                className={cn(
                  'text-sm',
                  message?.includes('VirtualBox window') ? 'text-warning' : 'text-gray-200'
                )}
              >
                {message ?? 'Preparing lab…'}
              </p>
            ) : (
              <p className="text-center text-sm text-gray-200">
                {message ?? readinessLabel ?? 'Installing desktop OS…'}
                <span className="text-muted"> — keep this window open.</span>
              </p>
            )}
            <div
              className={cn(
                'flex items-center gap-3',
                compactDesktopSetup && 'rounded-lg border border-border/60 bg-background/40 px-3 py-2.5'
              )}
            >
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-background-elevated">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    status === 'warning' ? 'bg-warning' : status === 'error' ? 'bg-danger' : 'bg-accent'
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                />
              </div>
              <span className="shrink-0 tabular-nums text-xs text-muted-dim">{formatElapsed(elapsedMs)}</span>
            </div>
            {!compactDesktopSetup ? (
              <div className="flex justify-between text-xs text-muted">
                <span className="font-mono uppercase tracking-wide">
                  {isPreparingDesktop
                    ? (readinessLabel ?? step?.replace(/_/g, ' ') ?? 'starting')
                    : (step?.replace(/_/g, ' ') ?? 'starting')}
                </span>
              </div>
            ) : null}
            {compactDesktopSetup && (canContinueToLab || canCancel) ? (
              <div className="space-y-2">
                {canContinueToLab ? (
                  <p className="text-center text-xs text-muted">
                    When the desktop looks ready below, continue to open the lab session. The lab timer
                    starts when you click Start lab.
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-end gap-2">
                {canCancel ? (
                  <Button variant="ghost" size="sm" onClick={onCancel} disabled={continuingToLab}>
                    Cancel setup
                  </Button>
                ) : null}
                {canContinueToLab ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleContinueToLab()}
                    disabled={continuingToLab}
                  >
                    {continuingToLab ? 'Finishing setup…' : 'Continue to lab'}
                  </Button>
                ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {phase === 'failed' ? (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <p className="font-medium">{errorMessage ?? 'Lab could not be deployed.'}</p>
            {failedStep ? (
              <p className="mt-1 text-xs text-danger/90">
                Failed during: <span className="font-mono">{failedStep.replace(/_/g, ' ')}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === 'canceled' ? (
          <p className="text-sm text-muted">Lab start canceled. Partial resources were cleaned up.</p>
        ) : null}

        {phase === 'failed' && preservedContainers ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Failed lab containers were kept running for inspection (Developer Mode). Use diagnostics below,
            then clean up when finished.
          </p>
        ) : null}

        {!showSetupPreview ? (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background/50 p-3 font-mono text-[11px] leading-relaxed text-muted">
            {logs.length === 0 ? (
              <p className="text-muted-dim">Waiting for status…</p>
            ) : (
              <ul className="space-y-1">
                {logs.map((entry, i) => (
                  <li key={`${entry.step}-${i}`} className="flex gap-2">
                    <span
                      className={cn(
                        'shrink-0 uppercase',
                        entry.status === 'error'
                          ? 'text-danger'
                          : entry.status === 'warning'
                            ? 'text-warning'
                            : entry.status === 'success'
                              ? 'text-success'
                              : 'text-accent'
                      )}
                    >
                      {entry.status === 'success' ? '✓' : entry.status === 'error' ? '✗' : '›'}
                    </span>
                    <span className="text-gray-300">{entry.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {showDeveloperDetails && developerDetails ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDiagnosticsOpen((v) => !v)}>
                {diagnosticsOpen ? 'Hide diagnostics' : 'View logs'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void handleCopyDiagnostics()}>
                Copy diagnostics
              </Button>
            </div>
            {diagnosticsOpen ? (
              <pre className="max-h-64 overflow-auto rounded border border-border bg-background p-2 text-[10px] text-muted whitespace-pre-wrap">
                {developerDetails}
              </pre>
            ) : null}
          </>
        ) : null}
      </div>

      {showModalFooter ? (
      <div
        className={cn(
          'flex shrink-0 flex-wrap justify-end gap-2 px-6 py-4',
          !compactDesktopSetup && 'border-t border-border'
        )}
      >
        {canStartLab ? (
          <Button variant="primary" size="sm" onClick={onStartLab}>
            Start lab
          </Button>
        ) : null}
        {canContinueToLab ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleContinueToLab()}
            disabled={continuingToLab}
          >
            {continuingToLab ? 'Finishing setup…' : 'Continue to lab'}
          </Button>
        ) : null}
        {canCancel && !compactDesktopSetup ? (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel setup
          </Button>
        ) : null}
        {phase === 'failed' ? (
          <>
            {onCleanup ? (
              <Button variant="ghost" size="sm" onClick={onCleanup}>
                {preservedContainers ? 'Clean up preserved containers' : 'Clean up'}
              </Button>
            ) : null}
            {onRetry ? (
              <Button variant="primary" size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={onDismiss}>
              Close
            </Button>
          </>
        ) : null}
        {phase === 'canceled' ? (
          <Button variant="secondary" size="sm" onClick={onDismiss}>
            Close
          </Button>
        ) : null}
        {isReady ? (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Close
          </Button>
        ) : null}
      </div>
      ) : null}
    </Modal>
  )
}

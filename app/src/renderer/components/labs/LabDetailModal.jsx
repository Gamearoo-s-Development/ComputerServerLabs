/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import SafetyBadge from '../safety/SafetyBadge.jsx'
import WhySafeSection from '../safety/WhySafeSection.jsx'
import { Button, Modal } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import {
  estimatedMinutesForDifficulty,
  formatUnlockRequirements,
  labThumbnailStyle,
  labInitials,
  runtimeIcon
} from './labBrowserUtils.js'

/**
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   labSummary: object | null
 *   dockerReady: boolean
 *   onStart: (labId: string) => Promise<void>
 *   starting: boolean
 * }} props
 */
export default function LabDetailModal({ open, onClose, labSummary, dockerReady, onStart, starting }) {
  const { profile } = useAppState()
  const developerMode = profile?.settings?.developerMode === true
  const showLabDebugInfo = developerMode && profile?.settings?.showLabDebugInfo === true
  const [detail, setDetail] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const loadDetail = useCallback(async () => {
    if (!labSummary?.valid || !labSummary?.id) {
      setDetail(null)
      setLoadError(null)
      return
    }
    const api = getApi()
    if (!api?.labs?.get) return
    setLoadError(null)
    try {
      const result = await api.labs.get(labSummary.id)
      if (result.ok) {
        setDetail(result.data)
      } else {
        setLoadError(result.error?.message ?? 'Failed to load lab')
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load lab')
    }
  }, [labSummary])

  useEffect(() => {
    if (!open || !labSummary) {
      setDetail(null)
      setLoadError(null)
      return
    }
    void loadDetail()
  }, [open, labSummary, loadDetail])

  if (!labSummary) return null

  const tasks = detail?.tasks ?? []
  const hints = detail?.hints ?? []
  const ports = detail?.docker?.ports ?? labSummary.ports ?? []
  const isLocked = labSummary.locked === true
  const unlockLines = isLocked ? formatUnlockRequirements(labSummary) : []
  const canStart = dockerReady && labSummary.valid && labSummary.runnable && !isLocked

  return (
    <Modal open={open} onClose={onClose} title={labSummary.title} size="lg">
      <div className="max-h-[min(70vh,36rem)] overflow-y-auto">
        <div
          className="relative flex h-24 items-center justify-center border-b border-border/60"
          style={labThumbnailStyle(labSummary.id, labSummary.category)}
        >
          <span className="text-3xl font-bold tracking-wide text-white/90 drop-shadow-md">
            {labInitials(labSummary.title)}
          </span>
          <span className="absolute right-4 top-4 text-2xl opacity-90" title={labSummary.runtime}>
            {runtimeIcon(labSummary.runtime)}
          </span>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-dim">{labSummary.category}</span>
            <SafetyBadge compact />
          </div>
          <p className="text-sm text-muted">{labSummary.description}</p>

          {!labSummary.valid ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {labSummary.errors?.[0] ?? 'This lab definition is invalid.'}
            </p>
          ) : null}

          {labSummary.valid ? (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-dim">Difficulty</dt>
                <dd className="font-medium text-gray-200">{labSummary.difficulty}</dd>
              </div>
              <div>
                <dt className="text-muted-dim">Est. time</dt>
                <dd className="font-medium text-gray-200">{estimatedMinutesForDifficulty(labSummary.difficulty)}</dd>
              </div>
              <div>
                <dt className="text-muted-dim">Hints</dt>
                <dd className="font-medium text-gray-200">{labSummary.hintCount ?? hints.length ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-dim">XP reward</dt>
                <dd className="font-medium text-accent">{labSummary.xpReward ?? detail?.xpReward ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-dim">Runtime</dt>
                <dd className="font-medium text-gray-200">
                  {runtimeIcon(labSummary.runtime)} {labSummary.runtime}
                </dd>
              </div>
              <div>
                <dt className="text-muted-dim">Validation</dt>
                <dd className="font-mono text-xs text-gray-300">{detail?.validation?.type ?? '—'}</dd>
              </div>
            </dl>
          ) : null}

          {showLabDebugInfo && labSummary.valid && ports.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase text-muted-dim">Ports / runtime (debug)</p>
              <ul className="mt-1 space-y-1 font-mono text-xs text-gray-300">
                {ports.map((p, i) => (
                  <li key={i}>
                    host {p.host ?? '?'} → container {p.container}
                  </li>
                ))}
              </ul>
              {detail?.docker?.image ? (
                <p className="mt-2 break-all font-mono text-[11px] text-muted-dim">Image: {detail.docker.image}</p>
              ) : null}
            </div>
          ) : null}

          {isLocked ? (
            <div
              className="rounded-lg border border-warning/25 bg-warning/5 p-3 text-sm text-muted"
              title="Complete earlier labs to unlock this challenge."
            >
              <p className="font-medium text-warning">This lab is locked</p>
              <ul className="mt-2 space-y-1 text-xs">
                {unlockLines.map((line, i) => (
                  <li key={i} className={line.startsWith('-') ? 'pl-3' : ''}>
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-dim">
                Complete earlier labs to unlock this challenge.
              </p>
            </div>
          ) : null}

          {labSummary.valid && tasks.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase text-muted-dim">Lab Objectives</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted">
                {tasks.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {labSummary.valid ? (
            <div className="rounded-lg border border-border-muted bg-background-elevated/50 p-3 text-xs text-muted">
              <p className="font-medium text-gray-300">Requirements</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Lab deployment engine online on this machine</li>
                <li>Secure shell client for remote lab targets</li>
                <li>Lab credentials are issued per deployment — ignore placeholder README credentials</li>
              </ul>
            </div>
          ) : null}

          {labSummary.warnings?.length ? (
            <p className="rounded-lg border border-warning/25 bg-warning/5 px-3 py-2 text-xs text-warning">
              {labSummary.warnings.join(' ')}
            </p>
          ) : null}

          <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-xs text-muted">
            <p className="font-medium text-warning">Future VM labs</p>
            <p className="mt-1">
              VM-based scenarios will require explicit confirmation before any host-level access. Container labs remain
              isolated by default.
            </p>
          </div>

          <WhySafeSection />

          {loadError ? <p className="text-xs text-warning">{loadError}</p> : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="primary"
              size="sm"
              disabled={!canStart || starting}
              title={isLocked ? 'Complete earlier labs to unlock this challenge.' : undefined}
              onClick={() => onStart(labSummary.id)}
            >
              {starting ? 'Starting…' : isLocked ? 'Locked' : 'Start lab'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
          {!dockerReady && labSummary.valid ? (
            <p className="text-xs text-warning">Lab systems offline — visit Health Checks or Environment Setup.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}

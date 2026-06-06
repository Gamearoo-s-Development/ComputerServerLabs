/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { Button, StatusBadge } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { cn } from '../../utils/cn.js'

const PRIORITY_VARIANT = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'success'
}

/**
 * @param {{
 *   open: boolean
 *   labId: string | null
 *   labTitle?: string | null
 *   onClose: () => void
 *   onStartInvestigation: () => void
 *   onViewEnvironment?: () => void
 * }} props
 */
export default function LabIncidentBriefingModal({
  open,
  labId,
  labTitle,
  onClose,
  onStartInvestigation,
  onViewEnvironment
}) {
  const [loading, setLoading] = useState(false)
  const [briefing, setBriefing] = useState(null)
  const [error, setError] = useState(null)
  const [selectedAttachment, setSelectedAttachment] = useState(null)
  const [attachmentContent, setAttachmentContent] = useState(null)
  const [showEnvironment, setShowEnvironment] = useState(false)

  useEffect(() => {
    if (!open || !labId) {
      setBriefing(null)
      setError(null)
      setSelectedAttachment(null)
      setAttachmentContent(null)
      setShowEnvironment(false)
      return
    }
    const api = getApi()
    if (!api?.labs?.incidentBriefing) return
    setLoading(true)
    void api.labs.incidentBriefing(labId).then((res) => {
      setLoading(false)
      if (res?.ok) setBriefing(res.data)
      else setError(res.error?.message ?? 'Could not load incident briefing.')
    })
  }, [open, labId])

  const loadAttachment = useCallback(
    async (filename) => {
      const api = getApi()
      if (!api?.labs?.readAttachment || !labId) return
      setSelectedAttachment(filename)
      setAttachmentContent(null)
      const res = await api.labs.readAttachment(labId, filename)
      if (res?.ok) setAttachmentContent(res.data.content)
      else setAttachmentContent(res.error?.message ?? 'Failed to load attachment.')
    },
    [labId]
  )

  const ticket = briefing?.ticket
  const incident = briefing?.incident
  const priority = ticket?.priority ?? incident?.severity ?? 'medium'
  const isCritical = priority === 'critical' || incident?.severity === 'critical'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={showEnvironment ? 'Environment info' : 'Incident ticket'}
      size="lg"
    >
      <div className="max-h-[75vh] space-y-4 overflow-auto p-4">
        {loading ? <p className="text-sm text-muted">Loading incident briefing…</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {!loading && briefing && !showEnvironment ? (
          <>
            {isCritical || incident?.outageBanner ? (
              <div
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm',
                  isCritical
                    ? 'animate-pulse border-danger/50 bg-danger/10 text-danger'
                    : 'border-warning/40 bg-warning/10 text-warning'
                )}
              >
                {isCritical ? 'CRITICAL OUTAGE — production impact reported' : 'Service disruption reported'}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label="Priority"
                value={priority.toUpperCase()}
                variant={PRIORITY_VARIANT[priority] ?? 'warning'}
                pulse={isCritical}
              />
              <span className="font-mono text-xs text-accent">{ticket?.id}</span>
              {ticket?.department ? (
                <span className="text-xs text-muted">{ticket.department}</span>
              ) : null}
            </div>

            <div>
              <p className="text-xs text-muted-dim">Requester</p>
              <p className="text-sm text-white">{ticket?.requester}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white">{ticket?.summary}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{ticket?.description}</p>
              {ticket?.escalationNotes ? (
                <p className="mt-2 rounded border border-warning/25 bg-warning/5 px-2 py-1 text-xs text-warning">
                  Escalation: {ticket.escalationNotes}
                </p>
              ) : null}
            </div>

            {incident?.affectedServices?.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Affected services</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {incident.affectedServices.map((s) => (
                    <li key={s} className="rounded-full border border-border px-2 py-0.5 text-xs text-gray-200">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {incident?.monitoringAlerts?.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
                  {incident.monitoringSystem ?? 'Monitoring'} alerts
                </p>
                <ul className="mt-2 space-y-2">
                  {incident.monitoringAlerts.map((alert, i) => (
                    <li key={i} className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs">
                      <span className="font-semibold text-danger">{alert.title}</span>
                      <p className="mt-1 text-muted">{alert.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {incident?.timeline?.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Timeline</p>
                <ol className="mt-2 space-y-2 border-l border-border pl-4">
                  {incident.timeline.map((entry, i) => (
                    <li key={i} className="relative text-xs">
                      <span className="absolute -left-[1.15rem] top-1 h-2 w-2 rounded-full bg-accent" />
                      <time className="font-mono text-muted-dim">{entry.time ?? '—'}</time>
                      <p className="font-medium text-gray-200">{entry.label}</p>
                      {entry.detail ? <p className="text-muted">{entry.detail}</p> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {briefing.attachments?.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Attachments</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {briefing.attachments.map((a) => (
                    <button
                      key={a.id ?? a.filename}
                      type="button"
                      onClick={() => void loadAttachment(a.filename)}
                      className={cn(
                        'rounded-lg border px-2 py-1 text-xs transition-colors',
                        selectedAttachment === a.filename
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border text-gray-300 hover:border-accent/40'
                      )}
                    >
                      {a.title}
                    </button>
                  ))}
                </div>
                {attachmentContent ? (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-border bg-background p-2 font-mono text-[11px] text-gray-300">
                    {attachmentContent}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {showEnvironment && briefing ? (
          <div className="space-y-3 text-sm text-muted">
            <p>
              <strong className="text-white">Lab:</strong> {labTitle ?? labId}
            </p>
            {incident?.company ? (
              <p>
                <strong className="text-white">Organization:</strong> {incident.company}
              </p>
            ) : null}
            <p>{ticket?.description}</p>
            <p className="text-xs text-muted-dim">
              Deploying will provision an isolated Docker environment. Credentials and file paths may vary each run.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        {onViewEnvironment ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (showEnvironment) {
                setShowEnvironment(false)
                onViewEnvironment()
              } else {
                setShowEnvironment(true)
              }
            }}
          >
            {showEnvironment ? 'Back to ticket' : 'View environment info'}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setShowEnvironment((v) => !v)}>
            {showEnvironment ? 'Back to ticket' : 'View environment info'}
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={onStartInvestigation} disabled={loading || !briefing}>
          Start investigation
        </Button>
      </div>
    </Modal>
  )
}

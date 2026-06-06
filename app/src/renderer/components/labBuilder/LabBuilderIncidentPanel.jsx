/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { Button, Card } from '../ui/index.js'
/**
 * @param {{ formLab: object, applyLabUpdate: (lab: object) => void }} props
 */
export default function LabBuilderIncidentPanel({ formLab, applyLabUpdate }) {
  const ticket = formLab.ticket ?? {}
  const incident = formLab.incident ?? {}
  const review = formLab.postLabReview ?? {}

  function patchTicket(partial) {
    applyLabUpdate({ ...formLab, ticket: { ...ticket, ...partial } })
  }

  function patchIncident(partial) {
    applyLabUpdate({ ...formLab, incident: { ...incident, ...partial } })
  }

  function patchReview(partial) {
    applyLabUpdate({ ...formLab, postLabReview: { ...review, ...partial } })
  }

  function addHistoryEntry() {
    const history = [...(ticket.history ?? [])]
    history.push({
      time: new Date().toISOString(),
      author: 'Support',
      message: 'Update…',
      redHerring: false
    })
    patchTicket({ history })
  }

  function addTimelineEntry() {
    const timeline = [...(incident.timeline ?? [])]
    timeline.push({
      time: new Date().toISOString(),
      label: 'Event',
      detail: '',
      redHerring: false
    })
    patchIncident({ timeline })
  }

  function addAttachment() {
    const attachments = [...(formLab.attachments ?? [])]
    attachments.push({
      id: `attach-${attachments.length + 1}`,
      filename: 'notes.txt',
      title: 'Investigation note',
      type: 'note',
      visibleAtStart: true,
      redHerring: false
    })
    applyLabUpdate({ ...formLab, attachments })
  }

  function addMonitoringAlert() {
    const alerts = [...(incident.monitoringAlerts ?? [])]
    alerts.push({
      title: 'Alert',
      message: 'Threshold exceeded.',
      severity: 'high',
      redHerring: false
    })
    patchIncident({ monitoringAlerts: alerts })
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Incident ticket</h3>
        <p className="mt-1 text-xs text-muted">
          Fake support ticket shown before deploy. Use fictional names only — no real companies or credentials.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(formLab.ticket?.id || formLab.ticket?.summary)}
            onChange={(e) => {
              if (!e.target.checked) {
                const next = { ...formLab }
                delete next.ticket
                applyLabUpdate(next)
              } else {
                patchTicket({
                  id: `INC-${(formLab.id ?? 'lab').slice(0, 8)}`,
                  type: 'incident',
                  priority: 'medium',
                  department: 'IT Operations',
                  requester: 'Service Desk',
                  summary: formLab.title ?? 'Production issue reported',
                  description: formLab.description ?? '',
                  history: []
                })
              }
            }}
            className="rounded border-border"
          />
          Enable ticket / incident briefing
        </label>
        {formLab.ticket ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs text-muted">Ticket ID</span>
              <input
                value={ticket.id ?? ''}
                onChange={(e) => patchTicket({ id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted">Priority</span>
              <select
                value={ticket.priority ?? 'medium'}
                onChange={(e) => patchTicket({ priority: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted">Requester</span>
              <input
                value={ticket.requester ?? ''}
                onChange={(e) => patchTicket({ requester: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted">Department</span>
              <input
                value={ticket.department ?? ''}
                onChange={(e) => patchTicket({ department: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              />
            </label>
            <label className="md:col-span-2 block text-sm">
              <span className="text-xs text-muted">Summary</span>
              <input
                value={ticket.summary ?? ''}
                onChange={(e) => patchTicket({ summary: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              />
            </label>
            <label className="md:col-span-2 block text-sm">
              <span className="text-xs text-muted">Description</span>
              <textarea
                value={ticket.description ?? ''}
                onChange={(e) => patchTicket({ description: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="md:col-span-2">
              <Button variant="ghost" size="sm" onClick={addHistoryEntry}>
                Add ticket comment
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {formLab.ticket ? (
        <>
          <Card className="!p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Incident & timeline</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="text-xs text-muted">Severity</span>
                <select
                  value={incident.severity ?? ticket.priority ?? 'medium'}
                  onChange={(e) => patchIncident({ severity: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm md:mt-6">
                <input
                  type="checkbox"
                  checked={incident.outageBanner === true}
                  onChange={(e) => patchIncident({ outageBanner: e.target.checked })}
                  className="rounded border-border"
                />
                Outage banner in session
              </label>
              <label className="md:col-span-2 block text-sm">
                <span className="text-xs text-muted">Affected services (comma-separated)</span>
                <input
                  value={(incident.affectedServices ?? []).join(', ')}
                  onChange={(e) =>
                    patchIncident({
                      affectedServices: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
                />
              </label>
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={addTimelineEntry}>
              Add timeline event
            </Button>
            <Button variant="ghost" size="sm" className="mt-3 ml-2" onClick={addMonitoringAlert}>
              Add monitoring alert
            </Button>
          </Card>

          <Card className="!p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Objectives & tracking</h3>
            <label className="mt-3 block text-sm">
              <span className="text-xs text-muted">Objective display mode</span>
              <select
                value={formLab.objectiveDisplay ?? 'visible'}
                onChange={(e) => applyLabUpdate({ ...formLab, objectiveDisplay: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              >
                <option value="visible">Visible — show public objectives</option>
                <option value="partial">Partial — show high-level objectives only</option>
                <option value="hidden">Hidden — reveal as learner progresses</option>
                <option value="ticket-only">Ticket only — no objective checklist</option>
              </select>
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formLab.commandTracking?.enabled === true}
                onChange={(e) =>
                  applyLabUpdate({
                    ...formLab,
                    commandTracking: { enabled: e.target.checked }
                  })
                }
                className="rounded border-border"
              />
              Track commands & hints for post-lab review (non-punitive)
            </label>
          </Card>

          <Card className="!p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Attachments</h3>
            <p className="mt-1 text-xs text-muted">
              Place files in <code className="text-accent">labs/&lt;id&gt;/attachments/</code> and list them here.
            </p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={addAttachment}>
              Add attachment entry
            </Button>
            {(formLab.attachments ?? []).map((a, i) => (
              <div key={a.id ?? i} className="mt-3 rounded border border-border/60 p-2">
                <input
                  value={a.filename ?? ''}
                  onChange={(e) => {
                    const attachments = [...(formLab.attachments ?? [])]
                    attachments[i] = { ...attachments[i], filename: e.target.value }
                    applyLabUpdate({ ...formLab, attachments })
                  }}
                  placeholder="filename in attachments/"
                  className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs text-white"
                />
                <input
                  value={a.title ?? ''}
                  onChange={(e) => {
                    const attachments = [...(formLab.attachments ?? [])]
                    attachments[i] = { ...attachments[i], title: e.target.value }
                    applyLabUpdate({ ...formLab, attachments })
                  }}
                  placeholder="Display title"
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-white"
                />
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={a.redHerring === true}
                    onChange={(e) => {
                      const attachments = [...(formLab.attachments ?? [])]
                      attachments[i] = { ...attachments[i], redHerring: e.target.checked }
                      applyLabUpdate({ ...formLab, attachments })
                    }}
                  />
                  Red herring (decoy)
                </label>
              </div>
            ))}
          </Card>

          <Card className="!p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Post-lab review</h3>
            <label className="mt-3 block text-sm">
              <span className="text-xs text-muted">Resolution summary</span>
              <textarea
                value={review.summary ?? ''}
                onChange={(e) => patchReview({ summary: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-xs text-muted">Root cause (teaching)</span>
              <textarea
                value={review.rootCause ?? ''}
                onChange={(e) => patchReview({ rootCause: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-xs text-muted">Skills (comma-separated)</span>
              <input
                value={(review.skills ?? []).join(', ')}
                onChange={(e) =>
                  patchReview({
                    skills: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  })
                }
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
              />
            </label>
          </Card>
        </>
      ) : null}
    </div>
  )
}

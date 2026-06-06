/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import Modal from '../ui/Modal.jsx'
import { Button } from '../ui/index.js'

/**
 * @param {{
 *   open: boolean
 *   review: object | null
 *   labTitle?: string
 *   onClose: () => void
 * }} props
 */
export default function LabPostLabReviewModal({ open, review, labTitle, onClose }) {
  if (!review) return null

  return (
    <Modal open={open} onClose={onClose} title="Incident resolved" size="md">
      <div className="space-y-4 p-4 text-sm">
        <p className="text-lg font-semibold text-success">Incident resolved</p>
        {labTitle ? <p className="text-muted">{labTitle}</p> : null}
        <p className="leading-relaxed text-gray-200">{review.summary}</p>

        <div className="rounded-lg border border-border bg-background-elevated/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Likely root cause</p>
          <p className="mt-1 text-white">{review.rootCause}</p>
        </div>

        {review.skills?.length ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Skills practiced</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {review.skills.map((skill) => (
                <li key={skill} className="rounded-full border border-accent/30 px-2 py-0.5 text-xs text-accent">
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {review.commandsUsed?.length ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Commands used</p>
            <ul className="mt-1 text-xs text-muted">
              {review.commandsUsed.map(({ cmd, count }) => (
                <li key={cmd}>
                  <code className="text-accent">{cmd}</code> × {count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-4 text-xs text-muted-dim">
          {review.xpEarned > 0 ? <span>+{review.xpEarned} XP</span> : null}
          {review.hintsOpened > 0 ? <span>{review.hintsOpened} hint(s) opened</span> : null}
          {review.durationSec != null ? <span>{Math.round(review.durationSec / 60)} min</span> : null}
        </div>

        {review.recommendedLabs?.length ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Recommended next</p>
            <ul className="mt-1 text-xs text-accent">
              {review.recommendedLabs.map((lab) => (
                <li key={lab.id}>{lab.title ?? lab.id}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {review.teachingNotes ? (
          <p className="rounded border border-border/60 bg-background px-2 py-2 text-xs text-muted">
            {review.teachingNotes}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end border-t border-border px-4 py-3">
        <Button variant="primary" size="sm" onClick={onClose}>
          Continue
        </Button>
      </div>
    </Modal>
  )
}

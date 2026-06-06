/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { Card } from '../ui/index.js'
import SafetyBadge from './SafetyBadge.jsx'

export default function WhySafeSection() {
  return (
    <Card className="border-success/20 bg-success/5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-white">Why this is safe</h3>
        <SafetyBadge compact />
      </div>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        <li>Lab workloads run in isolated containers — not on your host shell.</li>
        <li>Lab checks execute inside the sandbox lab environment only.</li>
        <li>Safety Mode blocks privileged containers, host mounts, and risky checks.</li>
        <li>No passwords, shell history, or host paths are stored in the player progress database.</li>
        <li>Future VM labs will require explicit confirmation before any host-level access.</li>
      </ul>
    </Card>
  )
}

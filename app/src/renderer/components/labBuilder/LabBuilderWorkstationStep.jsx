/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { getApi } from '../../hooks/useApi.js'
import LabBuilderCustomWorkstation from './LabBuilderCustomWorkstation.jsx'

const DESKTOP_PROFILE_IDS = new Set([
  'desktop-container-ubuntu',
  'desktop-container-debian',
  'desktop-container-kali',
  'desktop-container-windows'
])

const WORKSTATION_PROFILE_OPTIONS = [
  { id: 'ubuntu-terminal', label: 'Docker Ubuntu Terminal' },
  { id: 'debian-terminal', label: 'Docker Debian Terminal' },
  { id: 'desktop-container-ubuntu', label: 'Ubuntu Desktop (Docker/QEMU)', desktop: true },
  { id: 'desktop-container-debian', label: 'Debian Desktop (Docker/QEMU)', desktop: true },
  { id: 'desktop-container-kali', label: 'Kali Desktop (Docker/QEMU)', desktop: true },
  { id: 'desktop-container-windows', label: 'Windows Desktop (Docker/QEMU)', desktop: true },
  { id: 'custom', label: 'Custom lab workstation image' }
]

/**
 * @param {{ formLab: object, applyLabUpdate: (lab: object) => void, patchWorkstation: (p: object) => void }} props
 */
export default function LabBuilderWorkstationStep({ formLab, applyLabUpdate, patchWorkstation }) {
  const [desktopRuntimes, setDesktopRuntimes] = useState([])

  useEffect(() => {
    const api = getApi()
    void api?.desktopRuntime?.list?.().then((res) => {
      if (res?.ok) setDesktopRuntimes(res.data?.runtimes ?? [])
    })
  }, [])

  const runtimeByProfileId = useMemo(() => {
    const map = new Map()
    for (const runtime of desktopRuntimes) {
      if (runtime?.id) map.set(runtime.id, runtime)
    }
    return map
  }, [desktopRuntimes])

  const recommended = formLab.workstation?.recommended ?? 'ubuntu-terminal'
  const recommendedRuntime = DESKTOP_PROFILE_IDS.has(recommended)
    ? runtimeByProfileId.get(recommended)
    : null

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Optional investigation workstation — separate from the lab target. Workstations always use a normal user (never
        root). Files belong on the Filesystem step (workstation scope).
      </p>
      <label className="block text-sm">
        <span className="text-xs text-muted">Recommended workstation</span>
        <select
          value={recommended}
          onChange={(e) => patchWorkstation({ recommended: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-white"
        >
          {WORKSTATION_PROFILE_OPTIONS.map((opt) => {
            const runtime = opt.desktop ? runtimeByProfileId.get(opt.id) : null
            const unavailable =
              runtime &&
              (runtime.status === 'unavailable' ||
                !runtime.image?.trim() ||
                runtime.enabled === false)
            const suffix = unavailable ? ' (unavailable on this machine)' : ''
            return (
              <option key={opt.id} value={opt.id} disabled={Boolean(unavailable && opt.desktop)}>
                {opt.label}
                {suffix}
              </option>
            )
          })}
        </select>
      </label>

      {recommendedRuntime ? (
        <p className="text-[11px] text-muted">
          Desktop runtime status:{' '}
          <span className={recommendedRuntime.status === 'available' ? 'text-success' : 'text-warning'}>
            {recommendedRuntime.status === 'available'
              ? 'Available (tested)'
              : recommendedRuntime.image?.trim()
                ? recommendedRuntime.statusReason ?? 'Configured — test in Settings → Desktop Runtime'
                : 'Not configured — set up in Settings → Desktop Runtime'}
          </span>
        </p>
      ) : null}

      <LabBuilderCustomWorkstation formLab={formLab} applyLabUpdate={applyLabUpdate} />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={formLab.workstation?.allowLocalTerminal === true}
          onChange={(e) => patchWorkstation({ allowLocalTerminal: e.target.checked })}
          className="mt-1 rounded border-border"
        />
        <span>
          <span className="text-gray-200">Allow Local Terminal Workstation</span>
          <span className="mt-1 block text-xs text-muted">
            Host shell on the player&apos;s PC — not sandboxed. Off by default.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={formLab.workstation?.allowWslLocalTerminal === true}
          onChange={(e) => patchWorkstation({ allowWslLocalTerminal: e.target.checked })}
          className="mt-1 rounded border-border"
        />
        <span>
          <span className="text-gray-200">Allow WSL Local Linux Terminal (Windows)</span>
          <span className="mt-1 block text-xs text-muted">
            Uses the player&apos;s real WSL distro — not the same as an isolated Docker workstation. Off by
            default.
          </span>
        </span>
      </label>
    </div>
  )
}

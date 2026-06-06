/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import os from 'os'
import { refreshDiscordRpcStatus } from './discordRpcManager.js'
import { scanInstalledLabs } from './labScanner.js'
import {
  detectAllTools,
  detectDocker,
  detectVirtualization,
  detectWsl,
  isDockerReady
} from './toolDetection.js'
import { buildWindowsDockerWslDiagnostics } from './wsl/wslDockerDiagnostics.js'
import { getExamplePathConversions } from './wsl/wslPaths.js'

const TOOL_DETECTORS = {
  docker: detectDocker,
  wsl: detectWsl,
  virtualization: detectVirtualization
}

const TOOL_IDS = Object.keys(TOOL_DETECTORS)
import { runCommand } from './utils/exec.js'

/** @type {object | null} */
let cachedSnapshot = null

function mapDockerPill(docker) {
  if (docker.status === 'installed' || docker.status === 'running') {
    return { label: 'Docker', value: 'Running', variant: 'success', detail: docker.version || docker.message }
  }
  if (docker.status === 'needs_setup') {
    return { label: 'Docker', value: 'Stopped', variant: 'warning', detail: docker.message }
  }
  if (docker.status === 'missing') {
    return { label: 'Docker', value: 'Missing', variant: 'danger', detail: docker.message }
  }
  return { label: 'Docker', value: docker.status, variant: 'warning', detail: docker.message }
}

function mapWslPill(wsl) {
  const details = wsl.wslDetails
  const detail = details?.defaultDistro
    ? `${wsl.message ?? ''} (${details.defaultDistro})`
    : wsl.message
  if (wsl.status === 'installed') {
    return { label: 'WSL', value: 'WSL 2', variant: 'success', detail }
  }
  if (wsl.status === 'n/a') {
    return { label: 'WSL', value: 'N/A', variant: 'neutral', detail: wsl.message }
  }
  if (wsl.status === 'missing') {
    return { label: 'WSL', value: 'Missing', variant: 'danger', detail: wsl.message }
  }
  if (wsl.status === 'needs_setup') {
    return { label: 'WSL', value: 'Needs WSL 2', variant: 'warning', detail: wsl.message }
  }
  return { label: 'WSL', value: wsl.status, variant: 'warning', detail: wsl.message }
}

function mapVirtPill(virt) {
  if (virt.status === 'installed') {
    return { label: 'Virtualization', value: 'Enabled', variant: 'success', detail: virt.message }
  }
  if (virt.status === 'missing' || virt.status === 'broken') {
    return { label: 'Virtualization', value: 'Off', variant: 'danger', detail: virt.message }
  }
  return { label: 'Virtualization', value: 'Check', variant: 'warning', detail: virt.message }
}

function getMemoryCpu() {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const usedPct = Math.round((usedMem / totalMem) * 100)
  const cpus = os.cpus()?.length ?? 0
  const load = os.loadavg?.()[0] ?? 0

  const memVariant = usedPct > 90 ? 'danger' : usedPct > 75 ? 'warning' : 'success'

  return {
    memory: {
      label: 'RAM',
      value: `${formatGb(usedMem)} / ${formatGb(totalMem)}`,
      variant: memVariant,
      detail: `${usedPct}% used`,
      usedPct
    },
    cpu: {
      label: 'CPU',
      value: `${cpus} cores`,
      variant: 'neutral',
      detail: load > 0 ? `load ${load.toFixed(2)}` : 'ready'
    }
  }
}

function formatGb(bytes) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

async function getDiskSummary() {
  if (process.platform === 'win32') {
    const result = await runCommand('powershell', [
      '-NoProfile',
      '-Command',
      "$d=Get-PSDrive -Name C; [math]::Round(($d.Used/1GB),1).ToString() + '|' + [math]::Round(($d.Free/1GB),1).ToString()"
    ])
    if (result.ok && result.stdout.includes('|')) {
      const [used, free] = result.stdout.split('|').map(Number)
      const freeVariant = free < 10 ? 'danger' : free < 30 ? 'warning' : 'success'
      return {
        label: 'Disk (C:)',
        value: `${free} GB free`,
        variant: freeVariant,
        detail: `${used} GB used`,
        freeGb: free
      }
    }
  }

  try {
    const stats = fs.statfsSync?.(process.cwd())
    if (stats) {
      const free = (stats.bfree * stats.bsize) / 1024 ** 3
      const freeVariant = free < 10 ? 'danger' : free < 30 ? 'warning' : 'success'
      return {
        label: 'Disk',
        value: `${free.toFixed(1)} GB free`,
        variant: freeVariant,
        detail: 'workspace volume',
        freeGb: free
      }
    }
  } catch {
    // statfs not available
  }

  return { label: 'Disk', value: 'Unknown', variant: 'unknown', detail: '', freeGb: null }
}

function buildSnapshotFromToolResults(tools, discord, labs, disk) {
  const [docker, virtualBox, vmware, hyperV, qemu, wsl, virtualization] = tools

  const { memory, cpu } = getMemoryCpu()
  const discordPill = {
    label: 'Discord RPC',
    value: discord.label,
    variant: discord.variant,
    detail: discord.enabled ? 'Rich Presence' : 'Disabled in settings'
  }

  const labsPill = {
    label: 'Labs',
    value: String(labs.count),
    variant: labs.count > 0 ? 'success' : 'warning',
    detail: labs.count > 0 ? `${labs.ids.length} definitions found` : 'Install lab packs to begin'
  }

  const pills = [
    mapDockerPill(docker),
    mapWslPill(wsl),
    mapVirtPill(virtualization),
    discordPill,
    labsPill,
    memory,
    cpu,
    disk
  ]

  const healthChecks = [
    { ...docker, category: 'containers' },
    { ...virtualBox, category: 'vm' },
    { ...vmware, category: 'vm' },
    { ...hyperV, category: 'vm' },
    { ...qemu, category: 'vm' },
    { ...wsl, category: 'platform' },
    { ...virtualization, category: 'platform' },
    {
      id: 'disk',
      name: disk.label,
      status:
        disk.variant === 'danger' ? 'broken' : disk.variant === 'warning' ? 'needs_setup' : 'installed',
      message: disk.detail || disk.value,
      variant: disk.variant,
      version: ''
    },
    {
      id: 'memory',
      name: 'Memory',
      status: memory.variant === 'danger' ? 'broken' : 'installed',
      message: memory.detail,
      variant: memory.variant,
      version: memory.value
    }
  ]

  const wslDetails = wsl.wslDetails ?? null
  const pathExamples = getExamplePathConversions()

  return {
    collectedAt: new Date().toISOString(),
    pills,
    healthChecks,
    tools,
    labs,
    docker,
    dockerReady: isDockerReady(docker),
    wsl,
    wslDetails,
    pathExamples,
    virtualization,
    vmware,
    virtualBox,
    hyperV,
    qemu,
    discord,
    memory,
    cpu,
    disk
  }
}

export async function collectSystemStatus() {
  const [tools, discord, labs, disk] = await Promise.all([
    detectAllTools(),
    refreshDiscordRpcStatus(),
    Promise.resolve(scanInstalledLabs()),
    getDiskSummary()
  ])

  let snapshot = buildSnapshotFromToolResults(tools, discord, labs, disk)

  if (process.platform === 'win32') {
    const dockerWsl = await buildWindowsDockerWslDiagnostics(snapshot.wslDetails, snapshot.docker)
    snapshot = { ...snapshot, dockerWslDiagnostics: dockerWsl }
  }

  cachedSnapshot = snapshot
  return snapshot
}

/**
 * Re-run detection for one tool and merge into the cached snapshot (read-only).
 * @param {string} toolId
 */
export async function refreshSingleTool(toolId) {
  const detect = TOOL_DETECTORS[toolId]
  if (!detect) {
    throw new Error(`Unknown tool: ${toolId}`)
  }

  const updated = await detect()
  const cached = getCachedSystemStatus() ?? (await collectSystemStatus())
  const idx = TOOL_IDS.indexOf(toolId)
  if (idx < 0) {
    throw new Error(`Unknown tool: ${toolId}`)
  }

  const tools = [...cached.tools]
  tools[idx] = updated

  const snapshot = buildSnapshotFromToolResults(
    tools,
    cached.discord,
    cached.labs,
    cached.disk
  )
  cachedSnapshot = snapshot
  return snapshot
}

export function getCachedSystemStatus() {
  return cachedSnapshot
}

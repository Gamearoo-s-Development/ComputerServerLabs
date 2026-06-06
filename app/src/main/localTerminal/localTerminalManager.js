/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { spawn } from 'child_process'
import os from 'os'
import { getSessionState } from '../labManager.js'
import { DEFAULT_LOOPBACK_HOST } from '../labPorts.js'
import { logger } from '../utils/logger.js'
import { detectWslEnvironment } from '../wsl/wslDetection.js'

/**
 * @returns {{ shell: string, args: string[] }}
 */
function resolveHostShell() {
  if (process.platform === 'win32') {
    const wt = process.env.WT_SESSION ? 'wt.exe' : null
    if (wt) {
      return { shell: 'wt.exe', args: ['-w', '0', 'powershell', '-NoLogo'] }
    }
    return { shell: process.env.ComSpec || 'cmd.exe', args: [] }
  }
  const shell = process.env.SHELL || '/bin/bash'
  return { shell, args: ['-l'] }
}

/**
 * @param {object} session
 */
/**
 * @param {object} session
 * @param {'host' | 'wsl'} kind
 */
function buildConnectionBanner(session, kind = 'host') {
  const routes = session.connectionRoutes ?? []
  const hostRoute =
    routes.find((r) => r.context === 'hostPc') ?? session.connection ?? routes[0] ?? null
  const title =
    kind === 'wsl'
      ? '=== Computer Server Labs — WSL Local Linux Terminal (NOT SANDBOXED) ==='
      : '=== Computer Server Labs — Local Terminal Workstation (NOT SANDBOXED) ==='
  const lines = [
    title,
    kind === 'wsl'
      ? 'Commands run inside your real WSL distribution and may affect files in that environment.'
      : 'Commands run on YOUR computer and may affect your real system.',
    'Prefer Docker container workstations for safer practice.',
    'Connect using localhost / host-published ports only — not Docker internal container IPs.',
    ''
  ]
  if (hostRoute) {
    lines.push('Lab target SSH (from this PC):')
    if (hostRoute.command) lines.push(`  ${hostRoute.command}`)
    else if (hostRoute.host && hostRoute.port) {
      lines.push(`  ssh ${hostRoute.username ?? 'user'}@${hostRoute.host} -p ${hostRoute.port}`)
    }
    if (hostRoute.password) {
      lines.push(`  Password: ${hostRoute.password}`)
    }
    lines.push('')
  } else {
    lines.push('Connection details are in the Labs session panel.')
    lines.push('')
  }
  lines.push('No commands are run automatically — connect manually when ready.')
  lines.push('===============================================================')
  return lines.join('\r\n')
}

/**
 * Open the user's real local terminal with connection info printed (no auto SSH).
 * @param {string} sessionId
 */
export async function openLocalHostTerminal(sessionId) {
  const session = getSessionState(sessionId)
  if (!session) {
    throw new Error('Lab session not found.')
  }
  if (
    session.helper?.workstationRuntime !== 'local-terminal' ||
    session.helper?.workstationProvider === 'host-wsl-terminal'
  ) {
    throw new Error('This session does not use Local Terminal Workstation.')
  }

  const banner = buildConnectionBanner(session, 'host')
  const { shell, args } = resolveHostShell()

  if (process.platform === 'win32') {
    const inner = `Write-Host @'\n${banner.replace(/'/g, "''")}\n'@;`
    const ps = spawn(
      'powershell.exe',
      ['-NoExit', '-NoLogo', '-Command', inner],
      { detached: true, stdio: 'ignore', windowsHide: false }
    )
    ps.unref()
    logger.info('localTerminal', 'Opened host PowerShell for local workstation', { sessionId })
    return { opened: true, shell: 'powershell' }
  }

  const script = `printf '%s\\n' "${banner.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"; exec ${shell}`
  const child = spawn(shell, args, {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, SGQ_LOCAL_TERMINAL: '1' }
  })
  child.unref()
  logger.info('localTerminal', 'Opened host shell for local workstation', { sessionId, shell })
  return { opened: true, shell }
}

/**
 * Open the user's default WSL distribution with connection info (no auto SSH).
 * @param {string} sessionId
 */
export async function openWslLocalHostTerminal(sessionId) {
  const session = getSessionState(sessionId)
  if (!session) {
    throw new Error('Lab session not found.')
  }
  if (session.helper?.workstationProvider !== 'host-wsl-terminal') {
    throw new Error('This session does not use WSL Local Linux Terminal.')
  }

  if (process.platform !== 'win32') {
    throw new Error('WSL Local Linux Terminal is only available on Windows.')
  }

  const wsl = await detectWslEnvironment()
  if (!wsl.installed || !wsl.wsl2Available) {
    throw new Error(
      'WSL 2 is not available. Install WSL and set the default version to 2, then recheck in Health Checks.'
    )
  }

  const distro = wsl.defaultDistro
  if (!distro) {
    throw new Error('No default WSL distribution found. Install a distro with wsl --install.')
  }

  const banner = buildConnectionBanner(session, 'wsl')
  const escaped = banner.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
  const child = spawn(
    'wsl.exe',
    ['-d', distro, 'bash', '-lc', `printf "%s\\n" "${escaped}"; exec bash -l`],
    { detached: true, stdio: 'ignore', windowsHide: false }
  )
  child.unref()
  logger.info('localTerminal', 'Opened WSL shell for WSL workstation', { sessionId, distro })
  return { opened: true, shell: 'wsl', distro }
}

/**
 * @param {string} sessionId
 */
export async function openLocalWorkstationTerminal(sessionId) {
  const session = getSessionState(sessionId)
  if (!session) {
    throw new Error('Lab session not found.')
  }
  if (session.helper?.workstationProvider === 'host-wsl-terminal') {
    return openWslLocalHostTerminal(sessionId)
  }
  return openLocalHostTerminal(sessionId)
}

/**
 * @param {object} route
 */
export function buildLocalTerminalRouteHint(route) {
  if (!route) return `ssh user@${DEFAULT_LOOPBACK_HOST} -p <port>`
  return route.command ?? `ssh ${route.username}@${route.host} -p ${route.port}`
}

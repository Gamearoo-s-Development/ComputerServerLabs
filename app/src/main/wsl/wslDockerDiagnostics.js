/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { resolveDockerCommand } from '../toolDetection.js'
import { runCommand } from '../utils/exec.js'
import { isDockerReady } from '../toolDetection.js'

/**
 * Build Docker + WSL guidance for Windows hosts (read-only).
 * @param {import('./wslDetection.js').WslDetectionSnapshot} [wsl]
 * @param {object} [dockerTool]
 */
export async function buildWindowsDockerWslDiagnostics(wsl, dockerTool) {
  if (process.platform !== 'win32') {
    return { hints: [], summary: null }
  }

  /** @type {string[]} */
  const hints = []
  let dockerOsType = 'unknown'
  let dockerCliOk = false

  const dockerBin = await resolveDockerCommand()
  if (dockerBin) {
    dockerCliOk = true
    const info = await runCommand(dockerBin, ['info', '--format', '{{.OSType}}'], { timeout: 12_000 })
    if (info.ok) {
      dockerOsType = String(info.stdout).trim().toLowerCase() || 'unknown'
    }
  }

  const dockerReady = dockerTool ? isDockerReady(dockerTool) : false

  if (!dockerCliOk) {
    hints.push('Docker CLI was not found. Install Docker Desktop and ensure docker is on your PATH.')
  } else if (!dockerReady) {
    hints.push('Docker is installed but the daemon is not running. Start Docker Desktop and wait until it is ready.')
  }

  if (dockerOsType === 'windows') {
    hints.push(
      'Docker is running Windows containers. Switch Docker Desktop to Linux containers for most labs.'
    )
  }

  if (wsl && !wsl.installed) {
    hints.push('WSL 2 is required by Docker Desktop Linux containers on Windows. Install WSL before using Linux container labs.')
  } else if (wsl && wsl.installed && !wsl.wsl2Available) {
    hints.push('WSL 2 is required by Docker Desktop Linux containers on Windows. Run: wsl --set-default-version 2')
  }

  if (wsl?.installed && wsl.dockerWslIntegration === 'unlikely') {
    hints.push(
      'Docker Desktop may need WSL integration enabled. In Docker Desktop → Settings → Resources → WSL Integration, enable your default distro.'
    )
  } else if (wsl?.installed && wsl.dockerWslIntegration === 'likely') {
    hints.push('Docker Desktop WSL integration appears configured (docker-desktop WSL distros detected).')
  }

  if (dockerOsType === 'linux' && dockerReady) {
    hints.push('Docker Linux containers mode looks available for lab workstations.')
  }

  return {
    hints,
    summary: hints.length ? hints[0] : null,
    dockerOsType,
    dockerCliOk,
    dockerReady
  }
}

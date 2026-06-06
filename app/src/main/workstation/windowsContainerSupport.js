/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { resolveDockerCommand } from '../toolDetection.js'
import { getHostOsLabel } from './workstationHostInfo.js'
import { logger } from '../utils/logger.js'

const execFileAsync = promisify(execFile)

export const WINDOWS_CONTAINER_SETUP_URL =
  'https://learn.microsoft.com/virtualization/windowscontainers/quick-start/set-up-environment'

export const WINDOWS_CONTAINER_TEST_IMAGE = 'mcr.microsoft.com/windows/nanoserver:ltsc2022'

/**
 * @param {{ dockerReady?: boolean, dockerServerOs?: string, dockerLinuxContainers?: boolean, dockerWindowsContainers?: boolean }} caps
 */
export function buildDockerModeStatus(caps) {
  if (!caps.dockerReady) {
    return {
      mode: 'stopped',
      modeLabel: 'Docker not running',
      active: false
    }
  }
  if (caps.dockerWindowsContainers || caps.dockerServerOs === 'windows') {
    return {
      mode: 'windows',
      modeLabel: 'Windows Containers Active',
      active: true
    }
  }
  if (caps.dockerLinuxContainers || caps.dockerServerOs === 'linux') {
    return {
      mode: 'linux',
      modeLabel: 'Linux Containers Active',
      active: true
    }
  }
  return {
    mode: 'unknown',
    modeLabel: 'Docker mode unknown',
    active: false
  }
}

/**
 * @param {{ hostOs?: string, isWindowsHost?: boolean, dockerReady?: boolean, dockerWindowsContainers?: boolean, dockerServerOs?: string }} caps
 */
export function buildWindowsWorkstationCompatibility(caps) {
  const host = getHostOsLabel(caps.hostOs ?? process.platform)
  const dockerMode = buildDockerModeStatus(caps)

  if (!caps.isWindowsHost && caps.hostOs !== 'win32') {
    return {
      available: false,
      status: 'unsupported-host',
      summary: 'Unavailable on this host OS',
      hostOsLabel: host.label,
      dockerModeLabel: dockerMode.modeLabel,
      reasons: [
        'Windows container workstations require Windows 10 or Windows 11.',
        'Linux and macOS hosts should use Linux container workstations (recommended).'
      ]
    }
  }

  if (!caps.dockerReady) {
    return {
      available: false,
      status: 'docker-stopped',
      summary: 'Docker Desktop is not running',
      hostOsLabel: host.label,
      dockerModeLabel: dockerMode.modeLabel,
      reasons: [
        'Start Docker Desktop on your Windows PC.',
        'Windows PowerShell workstations run inside Windows Server containers — not a full desktop VM.'
      ]
    }
  }

  if (!caps.dockerWindowsContainers) {
    return {
      available: false,
      status: dockerMode.mode === 'linux' ? 'linux-mode-active' : 'windows-mode-required',
      summary:
        dockerMode.mode === 'linux'
          ? 'Switch Docker Desktop to Windows containers'
          : 'Windows containers are not active',
      hostOsLabel: host.label,
      dockerModeLabel: dockerMode.modeLabel,
      reasons: buildWindowsModeMismatchReasons()
    }
  }

  return {
    available: true,
    status: 'ready',
    summary: 'Windows workstation available',
    hostOsLabel: host.label,
    dockerModeLabel: dockerMode.modeLabel,
    reasons: []
  }
}

/**
 * Bullet list for “Why is this disabled?” when Windows mode is not active.
 */
export function buildWindowsModeMismatchReasons() {
  return [
    'Docker Desktop is currently running Linux containers.',
    'Windows container workstations require switching Docker Desktop to Windows containers mode.',
    'Switching container mode restarts Docker and can take a minute.',
    'Linux container labs remain the recommended default on all systems.'
  ]
}

/**
 * @param {{ hostOs?: string, isWindowsHost?: boolean, dockerReady?: boolean, dockerWindowsContainers?: boolean, dockerServerOs?: string }} caps
 */
export function getWindowsWorkstationUnavailableMessage(caps) {
  const compat = buildWindowsWorkstationCompatibility(caps)
  if (compat.available) return null
  if (compat.status === 'unsupported-host') {
    return 'Windows container workstations need Windows 10/11 with Docker Desktop. Use a Linux container workstation instead.'
  }
  if (compat.status === 'docker-stopped') {
    return 'Start Docker Desktop to use the Windows PowerShell workstation (server container — not a desktop VM).'
  }
  if (compat.status === 'linux-mode-active') {
    return 'Docker is using Linux containers. Switch Docker Desktop to Windows containers to deploy this workstation.'
  }
  return 'Windows containers are not available. Use a Linux workstation or switch Docker Desktop to Windows containers.'
}

/**
 * @param {{ refresh?: boolean }} [options]
 */
export async function testWindowsContainerSupport(options = {}) {
  const host = getHostOsLabel()
  /** @type {{ step: string, success: boolean, detail: string }[]} */
  const steps = []

  if (process.platform !== 'win32') {
    return {
      success: false,
      status: 'unsupported-host',
      message: `Windows container test requires a Windows host (current: ${host.label}).`,
      hostOsLabel: host.label,
      dockerModeLabel: 'N/A',
      steps
    }
  }

  const dockerBin = await resolveDockerCommand()
  if (!dockerBin) {
    return {
      success: false,
      status: 'no-docker',
      message: 'Docker CLI was not found. Install Docker Desktop for Windows.',
      hostOsLabel: host.label,
      dockerModeLabel: 'Docker not running',
      steps
    }
  }

  let serverOs = 'unknown'
  try {
    const { stdout } = await execFileAsync(dockerBin, ['info', '--format', '{{.OSType}}'], {
      timeout: 20_000,
      windowsHide: true
    })
    serverOs = String(stdout).trim().toLowerCase() || 'unknown'
    steps.push({
      step: 'docker-info',
      success: true,
      detail: `Docker OSType: ${serverOs}`
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    steps.push({ step: 'docker-info', success: false, detail })
    logger.info('workstation', 'Windows container test: docker info failed', { detail })
    return {
      success: false,
      status: 'docker-info-failed',
      message: 'Could not read Docker info. Is Docker Desktop running?',
      hostOsLabel: host.label,
      dockerModeLabel: 'Unknown',
      steps
    }
  }

  const dockerModeLabel =
    serverOs === 'windows'
      ? 'Windows Containers Active'
      : serverOs === 'linux'
        ? 'Linux Containers Active'
        : 'Docker mode unknown'

  if (serverOs !== 'windows') {
    return {
      success: false,
      status: 'mode-mismatch',
      message:
        'Docker is in Linux containers mode. Switch Docker Desktop to Windows containers, then run this test again.',
      hostOsLabel: host.label,
      dockerModeLabel,
      steps
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      dockerBin,
      ['run', '--rm', WINDOWS_CONTAINER_TEST_IMAGE, 'cmd', '/c', 'ver'],
      { timeout: 180_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }
    )
    const verOut = [stdout, stderr].filter(Boolean).join('\n').trim()
    steps.push({
      step: 'nanoserver-run',
      success: true,
      detail: verOut || 'Windows container started successfully.'
    })
    return {
      success: true,
      status: 'ok',
      message: 'Windows container support looks good.',
      hostOsLabel: host.label,
      dockerModeLabel,
      steps,
      containerOutput: verOut
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    steps.push({ step: 'nanoserver-run', success: false, detail })
    logger.info('workstation', 'Windows container test: nanoserver run failed', { detail })

    let status = 'run-failed'
    let message = 'Windows container test failed. Check Docker Desktop logs and disk space.'
    const lower = detail.toLowerCase()
    if (/no matching manifest|version mismatch|does not match/i.test(lower)) {
      status = 'version-mismatch'
      message =
        'Windows image version mismatch. Your Docker host may need a different Windows base image (LTSC) or Windows updates.'
    } else if (/linux containers|switch to windows/i.test(lower)) {
      status = 'mode-mismatch'
      message = 'Docker reported Linux containers mode during the test run.'
    }

    return {
      success: false,
      status,
      message,
      hostOsLabel: host.label,
      dockerModeLabel,
      steps
    }
  }
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import os from 'os'
import { resolveDockerCommand } from './toolDetection.js'
import { runCommand } from './utils/exec.js'
import {
  detectWslEnvironment,
  WSL_INSTALL_COMMAND,
  WSL_SET_DEFAULT_VERSION_COMMAND,
  WSL_SETUP_GUIDE_URL
} from './wsl/wslDetection.js'
import { getSetting, setSetting } from './settingsManager.js'
import { logger } from './utils/logger.js'

/** @typedef {'ready' | 'needs_setup' | 'missing' | 'broken' | 'skipped'} SetupStepStatus */

/**
 * @typedef {{
 *   id: string
 *   title: string
 *   status: SetupStepStatus
 *   summary: string
 *   details?: string[]
 *   instructions?: { title: string, body: string, command?: string, url?: string }[]
 * }} SetupWizardStep
 */

const HELLO_WORLD_TIMEOUT_MS = 120_000

/**
 * @param {import('./wsl/wslDetection.js').WslDetectionSnapshot} wsl
 */
function evaluateWslStep(wsl) {
  /** @type {string[]} */
  const details = []
  if (wsl.statusRaw?.statusText) {
    details.push(`wsl --status: ${wsl.statusRaw.statusText.trim().slice(0, 240)}`)
  }
  if (wsl.distros?.length) {
    for (const d of wsl.distros) {
      details.push(`${d.default ? '* ' : '  '}${d.name} — ${d.state} — WSL ${d.version ?? '?'}`)
    }
  }

  const userDistros = (wsl.distros ?? []).filter((d) => !/docker-desktop/i.test(d.name))
  const defaultUserDistro =
    userDistros.find((d) => d.default) ?? (userDistros.length === 1 ? userDistros[0] : null)

  /** @type {SetupWizardStep['instructions']} */
  const instructions = [
    {
      title: 'Install WSL (Administrator PowerShell)',
      body: 'Run this command, reboot if prompted, then return here and recheck.',
      command: WSL_INSTALL_COMMAND
    },
    {
      title: 'Set WSL 2 as default (after reboot)',
      body: 'Ensures Docker Desktop can use Linux containers.',
      command: WSL_SET_DEFAULT_VERSION_COMMAND
    },
    {
      title: 'Microsoft WSL setup guide',
      body: 'Step-by-step documentation for Windows Subsystem for Linux.',
      url: WSL_SETUP_GUIDE_URL
    }
  ]

  if (!wsl.installed) {
    return {
      id: 'wsl',
      title: 'WSL 2',
      status: 'missing',
      summary: 'WSL is not installed.',
      details,
      instructions
    }
  }

  if (!wsl.wsl2Available) {
    return {
      id: 'wsl',
      title: 'WSL 2',
      status: 'needs_setup',
      summary: 'WSL is installed but WSL 2 is not confirmed as the default.',
      details,
      instructions
    }
  }

  if (!defaultUserDistro) {
    return {
      id: 'wsl',
      title: 'WSL 2',
      status: 'needs_setup',
      summary: 'Install a Linux distribution (Ubuntu recommended) for Docker integration.',
      details,
      instructions
    }
  }

  if (defaultUserDistro.version !== 2) {
    return {
      id: 'wsl',
      title: 'WSL 2',
      status: 'needs_setup',
      summary: `Default distro "${defaultUserDistro.name}" is not WSL 2.`,
      details,
      instructions
    }
  }

  return {
    id: 'wsl',
    title: 'WSL 2',
    status: 'ready',
    summary: `WSL 2 ready — default distro: ${defaultUserDistro.name}`,
    details
  }
}

/**
 * @param {{ runHelloWorld?: boolean }} [options]
 */
export async function runWindowsSetupWizardChecks(options = {}) {
  const platform = process.platform
  const isWindows = platform === 'win32'
  /** @type {SetupWizardStep[]} */
  const steps = []

  steps.push({
    id: 'os',
    title: 'Operating system',
    status: 'ready',
    summary: isWindows
      ? `Windows detected (${os.release()})`
      : `${platform} detected — WSL steps are not required`,
    details: [`Host: ${os.type()} ${os.release()}`, `Arch: ${os.arch()}`]
  })

  if (isWindows) {
    const status = await runCommand('wsl.exe', ['--status'], { timeout: 15_000 })
    const list = await runCommand('wsl.exe', ['-l', '-v'], { timeout: 15_000 })
    const wslSnap = await detectWslEnvironment({ refresh: true })
    wslSnap.statusRaw = {
      statusText: `${status.stdout}\n${status.stderr}`.trim(),
      listText: list.stdout
    }
    steps.push(evaluateWslStep(wslSnap))
  } else {
    steps.push({
      id: 'wsl',
      title: 'WSL 2',
      status: 'skipped',
      summary: 'Not required on this platform.'
    })
  }

  const dockerBin = await resolveDockerCommand()
  if (!dockerBin) {
    steps.push({
      id: 'docker-desktop',
      title: 'Docker Desktop',
      status: 'missing',
      summary: 'Docker CLI not found. Install Docker Desktop for Windows.',
      instructions: [
        {
          title: 'Docker Desktop for Windows',
          body: 'Download and install Docker Desktop, then enable the WSL 2 backend during setup.',
          url: 'https://docs.docker.com/desktop/setup/install/windows-install/'
        }
      ]
    })
    steps.push({
      id: 'docker-engine',
      title: 'Docker engine',
      status: 'missing',
      summary: 'Docker engine cannot be checked until Docker Desktop is installed.'
    })
    steps.push({
      id: 'hello-world',
      title: 'Test container',
      status: 'missing',
      summary: 'Run after Docker Desktop is installed and running.'
    })
  } else {
    const version = await runCommand(
      dockerBin,
      ['version', '--format', 'Client: {{.Client.Version}} | Server: {{.Server.Version}}'],
      { timeout: 15_000 }
    )
    steps.push({
      id: 'docker-desktop',
      title: 'Docker Desktop',
      status: version.ok ? 'ready' : 'needs_setup',
      summary: version.ok ? 'Docker CLI found.' : 'Docker CLI found but version check failed.',
      details: version.ok ? [version.stdout.trim()] : [version.stderr || version.stdout].filter(Boolean)
    })

    const info = await runCommand(
      dockerBin,
      ['info', '--format', '{{.OperatingSystem}} | {{.ServerVersion}} | {{.OSType}}'],
      { timeout: 20_000 }
    )
    let engineStatus /** @type {SetupStepStatus} */ = 'broken'
    let engineSummary = 'Docker engine did not respond.'
    /** @type {string[]} */
    const engineDetails = []
    if (info.ok) {
      engineStatus = 'ready'
      engineSummary = 'Docker engine is running.'
      engineDetails.push(info.stdout.trim())
    } else if (/cannot connect|daemon|pipe/i.test(info.stderr || '')) {
      engineStatus = 'needs_setup'
      engineSummary =
        'Docker is installed but the engine is not running. Start Docker Desktop and wait until it is ready.'
      engineDetails.push(info.stderr.trim())
    } else {
      engineDetails.push(info.stderr || info.stdout)
    }

    const osTypeResult = await runCommand(dockerBin, ['info', '--format', '{{.OSType}}'], { timeout: 12_000 })
    if (osTypeResult.ok && osTypeResult.stdout.trim().toLowerCase() === 'windows') {
      engineStatus = engineStatus === 'ready' ? 'needs_setup' : engineStatus
      engineSummary =
        'Docker is using Windows containers. Switch Docker Desktop to Linux containers (tray icon → Switch to Linux containers…).'
    }

    steps.push({
      id: 'docker-engine',
      title: 'Docker engine',
      status: engineStatus,
      summary: engineSummary,
      details: engineDetails,
      instructions:
        engineStatus !== 'ready'
          ? [
              {
                title: 'Start Docker Desktop',
                body: 'Launch Docker Desktop from the Start menu and wait until the whale icon shows “Docker Desktop is running”.'
              }
            ]
          : undefined
    })

    let helloStatus /** @type {SetupStepStatus} */ = 'needs_setup'
    let helloSummary = 'Run a quick hello-world container to verify pulls and runtime.'
    /** @type {string[]} */
    const helloDetails = []

    if (options.runHelloWorld && engineStatus === 'ready') {
      const hello = await runCommand(dockerBin, ['run', '--rm', 'hello-world'], {
        timeout: HELLO_WORLD_TIMEOUT_MS
      })
      if (hello.ok && /hello from docker/i.test(`${hello.stdout}\n${hello.stderr}`)) {
        helloStatus = 'ready'
        helloSummary = 'Test container ran successfully.'
        helloDetails.push(hello.stdout.trim().split('\n').slice(-3).join('\n'))
      } else {
        helloStatus = 'broken'
        helloSummary = 'Test container failed — check Docker Desktop logs.'
        helloDetails.push((hello.stderr || hello.stdout).trim().slice(0, 500))
      }
    } else if (engineStatus !== 'ready') {
      helloStatus = 'missing'
      helloSummary = 'Start the Docker engine before running the test container.'
    }

    steps.push({
      id: 'hello-world',
      title: 'Test container',
      status: helloStatus,
      summary: helloSummary,
      details: helloDetails.length ? helloDetails : ['Command: docker run --rm hello-world']
    })
  }

  const criticalIds = isWindows
    ? ['wsl', 'docker-desktop', 'docker-engine', 'hello-world']
    : ['docker-desktop', 'docker-engine', 'hello-world']

  const allReady = criticalIds.every((id) => steps.find((s) => s.id === id)?.status === 'ready')

  steps.push({
    id: 'complete',
    title: 'Setup complete',
    status: allReady ? 'ready' : 'needs_setup',
    summary: allReady
      ? 'Your system is ready for container labs.'
      : 'Finish the steps above, then run checks again.'
  })

  return {
    isWindows,
    platform,
    steps,
    allReady,
    windowsSetupComplete: getSetting('windowsSetupComplete') === true
  }
}

export function isWindowsSetupComplete() {
  return getSetting('windowsSetupComplete') === true
}

export function markWindowsSetupComplete(complete = true) {
  setSetting('windowsSetupComplete', complete === true)
  logger.info('setupWizard', complete ? 'Windows setup marked complete' : 'Windows setup marked incomplete')
  return { windowsSetupComplete: complete === true }
}

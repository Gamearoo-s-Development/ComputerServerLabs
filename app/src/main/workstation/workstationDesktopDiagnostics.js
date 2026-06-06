/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as dockerManager from '../dockerManager.js'
import { resolveDockerCommand } from '../toolDetection.js'
import { runCommand } from '../utils/exec.js'
import { scrubSensitiveText } from '../utils/logRedaction.js'
import {
  DOCKER_RUNTIME_HOST,
  DOCKER_RUNTIME_WSL_KVM,
  detectWslDockerKvmRuntime,
  getDesktopRuntimeStatusLabel,
  isWslDockerKvmRuntime
} from '../wsl/wslDockerKvm.js'
import { getWorkstationDesktopConfig } from './workstationDesktopConfig.js'
import { WorkstationStartError } from './workstationStartError.js'

const SECRET_ENV_KEYS = /password|secret|token|key|passwd|credential/i

/** Shown when desktop-container workstations cannot be used. */
export const DESKTOP_KVM_UNAVAILABLE_MESSAGE =
  'Desktop container workstations require KVM/nested virtualization. Your Docker setup does not expose KVM.'

export const DESKTOP_KVM_HELP_TEXT =
  'On Windows Docker Desktop, KVM-based desktop containers may not be available depending on WSL2/Hyper-V/nested virtualization support.'

/**
 * @param {object | null | undefined} profile
 */
export function isDesktopContainerProfile(profile) {
  if (!profile) return false
  const provider = profile.provider ?? ''
  if (provider === 'desktop-container-windows' || provider === 'desktop-container-linux') {
    return true
  }
  return provider.startsWith('desktop-container-')
}

/**
 * @param {object} caps
 */
export function isDesktopKvmAvailable(caps) {
  return caps?.dockerKvm?.available === true
}

/**
 * @param {string[]} envLines
 */
function formatEnvForReport(envLines) {
  return envLines
    .map((line) => {
      const idx = line.indexOf('=')
      if (idx < 0) return line
      const key = line.slice(0, idx)
      if (SECRET_ENV_KEYS.test(key)) {
        return `${key}=***REDACTED***`
      }
      return line
    })
    .join('\n')
}

/**
 * @param {string} text
 * @param {string} [runError]
 * @param {object} [state]
 */
export function classifyDesktopContainerFailure(text, runError, state) {
  const combined = scrubSensitiveText([text, runError, state?.error].filter(Boolean).join('\n'))
  /** @type {string[]} */
  const hints = []
  let summary = 'Windows desktop container failed to start.'

  if (/port is already allocated|address already in use/i.test(combined)) {
    hints.push('port_conflict')
    summary = 'Host port conflict — the desktop viewer port is already in use on localhost.'
  } else if (/no space left on device|disk quota|enospc/i.test(combined)) {
    hints.push('disk_space')
    summary = 'Insufficient disk space for the Windows desktop VM image or storage volume.'
  } else if (/cannot allocate memory|oom|out of memory|enospc.*memory/i.test(combined)) {
    hints.push('memory')
    summary = 'Insufficient memory to start the Windows desktop VM (try closing other apps or raising Docker memory).'
  } else if (
    /\/dev\/kvm|no such file.*kvm|kvm.*not supported|hardware virtualization|nested virtualization|hyper-v|hvf|whpx/i.test(
      combined
    )
  ) {
    hints.push('kvm_missing')
    summary =
      'Hardware virtualization (KVM) is not available inside Docker. Enable nested virtualization / KVM in Docker Desktop or your hypervisor.'
  } else if (/privileged|operation not permitted|permission denied.*device/i.test(combined)) {
    hints.push('privileged_device')
    summary = 'Docker denied privileged or device access required by the Windows desktop VM container.'
  } else if (/pull access denied|manifest unknown|not found.*pull|failed to pull|error pulling/i.test(combined)) {
    hints.push('image_pull')
    summary = 'Failed to pull the Windows desktop image. Check network access and the configured image name.'
  } else if (/invalid.*environment|unknown flag|invalid argument/i.test(combined)) {
    hints.push('invalid_env')
    summary = 'Docker rejected the container configuration (invalid environment or run flags).'
  } else if (/platform|no matching manifest|exec format error/i.test(combined)) {
    hints.push('platform')
    summary = 'Unsupported platform — this Windows desktop image may not run on your Docker host architecture.'
  } else if (/cannot connect to the docker daemon/i.test(combined)) {
    hints.push('docker_daemon')
    summary = 'Docker daemon is not running or not reachable.'
  } else if (state?.status === 'exited' || state?.status === 'dead') {
    hints.push('container_exited')
    const code = state.exitCode != null ? ` (exit code ${state.exitCode})` : ''
    summary = `Windows desktop container exited immediately after start${code}. See docker logs below.`
  } else if (state?.timedOut) {
    hints.push('start_timeout')
    summary =
      'Windows desktop container did not reach a running state in time. QEMU may still be booting, or the container crashed — see logs.'
  }

  return { summary, hints, combined }
}

/**
 * Probe whether host Docker CLI can access /dev/kvm (nested virt).
 */
export async function detectHostDockerKvm() {
  const dockerBin = await resolveDockerCommand()
  if (!dockerBin) {
    return {
      available: false,
      code: 'docker_missing',
      reason: 'Docker CLI is not available.',
      report: 'KVM check skipped: docker command not found.'
    }
  }

  const ready = await dockerManager.checkReady()
  if (!ready.ready) {
    return {
      available: false,
      code: 'docker_not_ready',
      reason: ready.message ?? 'Docker is not running.',
      report: `KVM check skipped: ${ready.message}`
    }
  }

  const probe = await runCommand(
    dockerBin,
    ['run', '--rm', '--device', '/dev/kvm', 'busybox:latest', 'sh', '-c', 'test -e /dev/kvm && echo KVM_OK'],
    { timeout: 60_000 }
  )

  const combined = `${probe.stdout}\n${probe.stderr}`
  if (probe.ok && /KVM_OK/.test(probe.stdout)) {
    return {
      available: true,
      code: null,
      reason: null,
      helpText: DESKTOP_KVM_HELP_TEXT,
      report: 'KVM probe: /dev/kvm is available inside Docker (host CLI).'
    }
  }

  const classified = classifyDesktopContainerFailure(combined, probe.stderr, null)
  const kvmMissing = classified.hints.includes('kvm_missing')
  return {
    available: false,
    code: kvmMissing ? 'kvm_missing' : 'kvm_probe_failed',
    reason: DESKTOP_KVM_UNAVAILABLE_MESSAGE,
    helpText: DESKTOP_KVM_HELP_TEXT,
    report: scrubSensitiveText(
      ['=== KVM probe (host docker run --device /dev/kvm busybox) ===', combined || '(no output)'].join('\n')
    )
  }
}

/**
 * Probe desktop KVM via host Docker, then WSL-backed Docker on Windows.
 */
export async function detectDockerKvm() {
  const hostResult = await detectHostDockerKvm()
  if (hostResult.available) {
    return {
      ...hostResult,
      runtime: DOCKER_RUNTIME_HOST,
      desktopRuntimeLabel: getDesktopRuntimeStatusLabel({ available: true, runtime: DOCKER_RUNTIME_HOST })
    }
  }

  if (process.platform === 'win32') {
    const wslRuntime = await detectWslDockerKvmRuntime()
    if (wslRuntime.available) {
      return {
        available: true,
        runtime: DOCKER_RUNTIME_WSL_KVM,
        code: null,
        reason: null,
        helpText:
          'Desktop containers run through WSL-backed Docker so /dev/kvm is available. Lab targets still use Docker Desktop normally.',
        report: [hostResult.report, wslRuntime.report].filter(Boolean).join('\n\n'),
        wslDockerKvm: wslRuntime,
        desktopRuntimeLabel: getDesktopRuntimeStatusLabel({
          available: true,
          runtime: DOCKER_RUNTIME_WSL_KVM
        })
      }
    }

    return {
      ...hostResult,
      runtime: null,
      wslDockerKvm: wslRuntime,
      desktopRuntimeLabel: getDesktopRuntimeStatusLabel({
        available: false,
        code: wslRuntime.code,
        wslDockerKvm: wslRuntime
      }),
      report: scrubSensitiveText(
        [hostResult.report, '=== WSL KVM fallback ===', wslRuntime.report ?? wslRuntime.reason]
          .filter(Boolean)
          .join('\n\n')
      )
    }
  }

  return {
    ...hostResult,
    runtime: null,
    desktopRuntimeLabel: getDesktopRuntimeStatusLabel({ available: false })
  }
}

/**
 * @param {{ available: boolean, code?: string | null, reason?: string | null, helpText?: string | null, report?: string | null }} kvm
 */
export function normalizeDockerKvmCapability(kvm) {
  if (kvm.available) {
    return {
      available: true,
      code: null,
      reason: null,
      helpText: kvm.helpText ?? DESKTOP_KVM_HELP_TEXT,
      report: kvm.report ?? null,
      runtime: kvm.runtime ?? DOCKER_RUNTIME_HOST,
      desktopRuntimeLabel:
        kvm.desktopRuntimeLabel ??
        getDesktopRuntimeStatusLabel({ available: true, runtime: kvm.runtime }),
      wslDockerKvm: kvm.wslDockerKvm ?? null
    }
  }
  return {
    available: false,
    code: kvm.code ?? 'kvm_unavailable',
    reason: kvm.reason ?? DESKTOP_KVM_UNAVAILABLE_MESSAGE,
    helpText: DESKTOP_KVM_HELP_TEXT,
    report: kvm.report ?? null,
    runtime: kvm.runtime ?? null,
    desktopRuntimeLabel:
      kvm.desktopRuntimeLabel ??
      getDesktopRuntimeStatusLabel({
        available: false,
        code: kvm.code,
        wslDockerKvm: kvm.wslDockerKvm
      }),
    wslDockerKvm: kvm.wslDockerKvm ?? null
  }
}

/**
 * @param {string} nameOrId
 * @param {object} [options]
 */
export async function collectDesktopWorkstationDiagnostics(nameOrId, options = {}) {
  const { containerName, image, runError, runSpec, waitResult, dockerRuntime } = options
  const dockerOpts = isWslDockerKvmRuntime(dockerRuntime) ? { runtime: dockerRuntime } : {}

  const state = nameOrId
    ? await dockerManager.inspectContainerState(nameOrId, dockerOpts).catch(() => ({
        status: 'unknown',
        running: false,
        exitCode: null,
        error: ''
      }))
    : { status: 'unknown', running: false, exitCode: null, error: '' }

  const logResult = nameOrId
    ? await dockerManager.getContainerLogs(nameOrId, { tail: 250, ...dockerOpts })
    : { ok: false, logs: '' }

  const inspect = nameOrId
    ? await dockerManager.inspectContainerDiagnostics(nameOrId, dockerOpts).catch((e) => ({
        error: e instanceof Error ? e.message : String(e)
      }))
    : null

  const logsText = logResult.logs ?? ''
  const classified = classifyDesktopContainerFailure(logsText, runError, {
    ...state,
    timedOut: waitResult?.timedOut === true
  })

  const lines = [
    '=== Windows Desktop Workstation diagnostics ===',
    `Summary: ${classified.summary}`,
    classified.hints.length ? `Detected issues: ${classified.hints.join(', ')}` : null,
    '',
    '--- container ---',
    `Name: ${containerName ?? inspect?.name ?? '(unknown)'}`,
    `ID: ${nameOrId ?? inspect?.id ?? '(not created)'}`,
    `Image: ${image ?? inspect?.image ?? '(unknown)'}`,
    `Status: ${state.status ?? 'unknown'}`,
    `Running: ${state.running === true}`,
    `Exit code: ${state.exitCode ?? '(n/a)'}`,
    state.error ? `State error: ${state.error}` : null,
    waitResult?.timedOut ? 'Wait: timed out before reaching running state' : null,
    '',
    '--- docker run (requested) ---',
    runSpec?.createCommand ? `Command: ${runSpec.createCommand}` : null,
    runSpec?.publishedPorts?.length
      ? `Port bindings: ${runSpec.publishedPorts.join(', ')}`
      : runSpec?.webPort
        ? `Viewer: 127.0.0.1:<host> -> ${runSpec.webPort}/tcp`
        : null,
    runSpec?.devices?.length ? `Devices: ${runSpec.devices.join(', ')}` : null,
    runSpec?.privileged ? 'Privileged: true' : null,
    runError ? `Run error:\n${scrubSensitiveText(runError)}` : null,
    '',
    '--- docker inspect ---',
    inspect?.error
      ? `Inspect failed: ${inspect.error}`
      : [
          inspect?.platform ? `Platform: ${inspect.platform}` : null,
          inspect?.created ? `Created: ${inspect.created}` : null,
          inspect?.cmd?.length ? `Cmd: ${JSON.stringify(inspect.cmd)}` : null,
          inspect?.entrypoint?.length ? `Entrypoint: ${JSON.stringify(inspect.entrypoint)}` : null,
          inspect?.portBindings?.length
            ? `Published ports:\n${inspect.portBindings.map((p) => `  ${p}`).join('\n')}`
            : null,
          inspect?.devices?.length ? `Devices: ${inspect.devices.join(', ')}` : null,
          inspect?.privileged != null ? `Privileged: ${inspect.privileged}` : null,
          inspect?.env?.length ? `Environment:\n${formatEnvForReport(inspect.env)}` : null
        ]
          .filter(Boolean)
          .join('\n'),
    '',
    '--- docker logs (tail) ---',
    logsText ? scrubSensitiveText(logsText) : '(no logs — container may not have been created)'
  ]

  const report = lines.filter((line) => line != null).join('\n').slice(0, 24000)

  return {
    summary: classified.summary,
    hints: classified.hints,
    report,
    state,
    logs: logsText
  }
}

/**
 * @param {object} [options]
 */
/**
 * Last-resort guard if desktop provisioning runs without KVM (should be blocked in UI).
 */
export async function assertDesktopKvmForProvision() {
  const kvm = normalizeDockerKvmCapability(await detectDockerKvm())
  if (kvm.available) {
    return {
      kvm,
      mode: kvm.runtime === DOCKER_RUNTIME_WSL_KVM ? 'wsl-kvm' : 'kvm',
      dockerRuntime: kvm.runtime ?? DOCKER_RUNTIME_HOST
    }
  }
  throw new WorkstationStartError(kvm.reason ?? DESKTOP_KVM_UNAVAILABLE_MESSAGE, {
    stage: 'kvm_unavailable',
    report: kvm.report ?? '',
    hints: ['kvm_missing']
  })
}

export function getDesktopResourceWarning() {
  const cfg = getWorkstationDesktopConfig()
  return cfg.resourceWarning
}

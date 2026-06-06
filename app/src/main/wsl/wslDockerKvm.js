/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import path from 'path'
import { runCommand } from '../utils/exec.js'
import { scrubSensitiveText } from '../utils/logRedaction.js'
import { logger } from '../utils/logger.js'
import { detectWslEnvironment } from './wslDetection.js'
import { windowsPathToWsl } from './wslPaths.js'

/** @typedef {'host-docker' | 'docker-wsl-kvm'} DockerDesktopRuntime */

export const DOCKER_RUNTIME_HOST = 'host-docker'
export const DOCKER_RUNTIME_WSL_KVM = 'docker-wsl-kvm'

export const WSL_DOCKER_INTEGRATION_MESSAGE =
  'Docker is not available inside WSL. Enable Docker Desktop WSL integration for your distro.'

const WSL_CMD_TIMEOUT_MS = 20_000
const WSL_DOCKER_PROBE_TIMEOUT_MS = 90_000

/** @type {import('./wslDockerKvm.js').WslDockerKvmSnapshot | null} */
let cachedSnapshot = null
/** @type {number} */
let cachedAt = 0
const CACHE_MS = 30_000

/**
 * @typedef {{
 *   available: boolean
 *   runtime: DockerDesktopRuntime | null
 *   wslKvmHost: boolean
 *   wslDockerLinux: boolean
 *   wslDockerKvm: boolean
 *   code: string | null
 *   reason: string | null
 *   report: string | null
 *   defaultDistro: string | null
 * }} WslDockerKvmSnapshot
 */

/**
 * @param {string} value
 */
function shellQuotePosix(value) {
  const str = String(value)
  if (/^[a-zA-Z0-9_./:@%+=,-]+$/.test(str)) return str
  return `'${str.replace(/'/g, `'\\''`)}'`
}

/**
 * @param {string[]} dockerArgs
 */
export function buildWslDockerShellCommand(dockerArgs) {
  return ['docker', ...dockerArgs].map(shellQuotePosix).join(' ')
}

/**
 * @param {string} shellCommand
 * @param {{ timeout?: number, distro?: string | null }} [options]
 */
export async function runWslShLc(shellCommand, options = {}) {
  /** @type {string[]} */
  const wslArgs = []
  if (options.distro) {
    wslArgs.push('-d', options.distro)
  }
  wslArgs.push('sh', '-lc', shellCommand)
  return runCommand('wsl.exe', wslArgs, {
    timeout: options.timeout ?? WSL_CMD_TIMEOUT_MS,
    windowsHide: true
  })
}

/**
 * Run docker CLI args through WSL (same Docker Desktop engine when integration is enabled).
 * @param {string[]} dockerArgs
 * @param {{ timeout?: number, distro?: string | null, cwd?: string }} [options]
 */
export async function runWslDockerCommand(dockerArgs, options = {}) {
  let shellCommand = buildWslDockerShellCommand(dockerArgs)
  if (options.cwd) {
    const wslCwd = windowsPathToWsl(path.resolve(options.cwd))
    if (!wslCwd) {
      throw new Error(`Could not convert working directory for WSL Docker: ${options.cwd}`)
    }
    shellCommand = `cd ${shellQuotePosix(wslCwd)} && ${shellCommand}`
  }
  return runWslShLc(shellCommand, options)
}

/**
 * @param {string} [distro]
 */
export async function probeWslHostKvm(distro) {
  const result = await runWslShLc('test -e /dev/kvm && echo KVM_OK || echo KVM_MISSING', {
    timeout: WSL_CMD_TIMEOUT_MS,
    distro
  })
  const out = `${result.stdout}\n${result.stderr}`
  return {
    ok: /KVM_OK/.test(result.stdout),
    output: scrubSensitiveText(out)
  }
}

/**
 * @param {string} [distro]
 */
export async function probeWslDockerLinux(distro) {
  const result = await runWslShLc("docker info --format '{{.OSType}}' 2>/dev/null", {
    timeout: WSL_CMD_TIMEOUT_MS,
    distro
  })
  const osType = String(result.stdout).trim().toLowerCase()
  const combined = scrubSensitiveText(`${result.stdout}\n${result.stderr}`)
  if (!result.ok || !osType) {
    return {
      ok: false,
      osType: osType || 'unknown',
      message: WSL_DOCKER_INTEGRATION_MESSAGE,
      output: combined
    }
  }
  if (osType !== 'linux') {
    return {
      ok: false,
      osType,
      message: `Docker inside WSL reports OSType=${osType}. Switch Docker Desktop to Linux containers.`,
      output: combined
    }
  }
  return { ok: true, osType, message: 'Docker Linux mode available inside WSL.', output: combined }
}

/**
 * @param {string} [distro]
 */
export async function probeWslDockerKvmInContainer(distro) {
  const cmd =
    "docker run --rm --device /dev/kvm busybox:latest sh -c 'test -e /dev/kvm && echo KVM_OK'"
  const result = await runWslShLc(cmd, { timeout: WSL_DOCKER_PROBE_TIMEOUT_MS, distro })
  const combined = scrubSensitiveText(`${result.stdout}\n${result.stderr}`)
  return {
    ok: result.ok && /KVM_OK/.test(result.stdout),
    output: combined
  }
}

/**
 * @param {{ refresh?: boolean }} [options]
 * @returns {Promise<WslDockerKvmSnapshot>}
 */
export async function detectWslDockerKvmRuntime(options = {}) {
  const now = Date.now()
  if (!options.refresh && cachedSnapshot && now - cachedAt < CACHE_MS) {
    return cachedSnapshot
  }

  if (process.platform !== 'win32') {
    cachedSnapshot = {
      available: false,
      runtime: null,
      wslKvmHost: false,
      wslDockerLinux: false,
      wslDockerKvm: false,
      code: 'not_windows',
      reason: null,
      report: null,
      defaultDistro: null
    }
    cachedAt = now
    return cachedSnapshot
  }

  const wslEnv = await detectWslEnvironment(options)
  const distro = wslEnv.defaultDistro ?? undefined

  /** @type {WslDockerKvmSnapshot} */
  let snapshot = {
    available: false,
    runtime: null,
    wslKvmHost: false,
    wslDockerLinux: false,
    wslDockerKvm: false,
    code: 'wsl_unavailable',
    reason: 'WSL 2 is not available on this host.',
    report: null,
    defaultDistro: wslEnv.defaultDistro ?? null
  }

  if (!wslEnv.installed || !wslEnv.wsl2Available) {
    cachedSnapshot = snapshot
    cachedAt = now
    return snapshot
  }

  const hostKvm = await probeWslHostKvm(distro)
  snapshot.wslKvmHost = hostKvm.ok
  if (!hostKvm.ok) {
    snapshot.code = 'wsl_kvm_missing'
    snapshot.reason = '/dev/kvm is not available inside WSL.'
    snapshot.report = ['=== WSL host KVM ===', hostKvm.output || '(no output)'].join('\n')
    cachedSnapshot = snapshot
    cachedAt = now
    return snapshot
  }

  const dockerProbe = await probeWslDockerLinux(distro)
  snapshot.wslDockerLinux = dockerProbe.ok
  if (!dockerProbe.ok) {
    snapshot.code = 'wsl_docker_missing'
    snapshot.reason = dockerProbe.message ?? WSL_DOCKER_INTEGRATION_MESSAGE
    snapshot.report = [
      '=== WSL host KVM ===',
      'KVM_OK',
      '=== WSL docker info ===',
      dockerProbe.output || '(no output)'
    ].join('\n')
    cachedSnapshot = snapshot
    cachedAt = now
    return snapshot
  }

  const dockerKvm = await probeWslDockerKvmInContainer(distro)
  snapshot.wslDockerKvm = dockerKvm.ok
  if (!dockerKvm.ok) {
    snapshot.code = 'wsl_docker_kvm_missing'
    snapshot.reason = 'KVM is not available inside Docker when invoked from WSL.'
    snapshot.report = [
      '=== WSL host KVM ===',
      'KVM_OK',
      '=== WSL docker KVM probe ===',
      dockerKvm.output || '(no output)'
    ].join('\n')
    cachedSnapshot = snapshot
    cachedAt = now
    return snapshot
  }

  snapshot = {
    available: true,
    runtime: DOCKER_RUNTIME_WSL_KVM,
    wslKvmHost: true,
    wslDockerLinux: true,
    wslDockerKvm: true,
    code: null,
    reason: null,
    report: [
      '=== WSL-backed desktop Docker runtime ===',
      'WSL /dev/kvm: OK',
      'WSL docker OSType: linux',
      'WSL docker KVM probe: KVM_OK'
    ].join('\n'),
    defaultDistro: wslEnv.defaultDistro ?? null
  }

  logger.info('wslDockerKvm', 'WSL Docker KVM runtime available', {
    distro: snapshot.defaultDistro
  })

  cachedSnapshot = snapshot
  cachedAt = now
  return snapshot
}

/**
 * Resolve desktop viewer URL reachable from Windows browser.
 * @param {{ host?: number, hostIp?: string } | null | undefined} mapping
 */
export function resolveDesktopViewerUrl(mapping) {
  if (!mapping?.host) return null
  const hostIp = mapping.hostIp && mapping.hostIp !== '0.0.0.0' ? mapping.hostIp : '127.0.0.1'
  const browserHost = hostIp === '0.0.0.0' ? '127.0.0.1' : hostIp
  return `http://${browserHost}:${mapping.host}/`
}

/**
 * @param {DockerDesktopRuntime | null | undefined} runtime
 */
export function isWslDockerKvmRuntime(runtime) {
  return runtime === DOCKER_RUNTIME_WSL_KVM
}

/**
 * @param {{ available?: boolean, runtime?: string | null, wslDockerKvm?: WslDockerKvmSnapshot | null }} kvm
 */
export function getDesktopRuntimeStatusLabel(kvm) {
  if (!kvm?.available) {
    if (kvm?.wslDockerKvm?.code === 'wsl_docker_missing' || kvm?.code === 'wsl_docker_missing') {
      return 'Unavailable — WSL Docker integration missing'
    }
    return 'Unavailable — KVM not available in Docker'
  }
  if (kvm.runtime === DOCKER_RUNTIME_WSL_KVM) {
    return 'WSL KVM Available'
  }
  return 'Host Docker KVM'
}

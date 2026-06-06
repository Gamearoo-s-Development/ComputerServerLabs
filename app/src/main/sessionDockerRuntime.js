/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { detectHostDockerKvm, isDesktopContainerProfile } from './workstation/workstationDesktopDiagnostics.js'
import {
  detectWslDockerKvmRuntime,
  DOCKER_RUNTIME_HOST,
  DOCKER_RUNTIME_WSL_KVM,
  isWslDockerKvmRuntime,
  WSL_DOCKER_INTEGRATION_MESSAGE
} from './wsl/wslDockerKvm.js'
import { logger } from './utils/logger.js'

/** Docker CLI on Windows (Docker Desktop engine). */
export const DOCKER_RUNTIME_WINDOWS = 'windows-docker'
/** Docker CLI via WSL integration (required for QEMU/KVM desktop on Windows). */
export const DOCKER_RUNTIME_WSL = 'wsl-docker'
/** Docker CLI on native Linux hosts. */
export const DOCKER_RUNTIME_NATIVE_LINUX = 'native-linux-docker'

/**
 * @param {string | null | undefined} runtime
 * @returns {string | null}
 */
export function normalizeSessionDockerRuntime(runtime) {
  if (!runtime) return null
  if (runtime === DOCKER_RUNTIME_WSL_KVM) return DOCKER_RUNTIME_WSL
  if (runtime === DOCKER_RUNTIME_HOST) {
    return process.platform === 'win32' ? DOCKER_RUNTIME_WINDOWS : DOCKER_RUNTIME_NATIVE_LINUX
  }
  return runtime
}

/**
 * @param {string | null | undefined} runtime
 * @returns {string | null}
 */
export function toDockerManagerRuntime(runtime) {
  const normalized = normalizeSessionDockerRuntime(runtime)
  if (normalized === DOCKER_RUNTIME_WSL) return DOCKER_RUNTIME_WSL_KVM
  if (normalized === DOCKER_RUNTIME_WINDOWS || normalized === DOCKER_RUNTIME_NATIVE_LINUX) {
    return DOCKER_RUNTIME_HOST
  }
  return runtime ?? null
}

/**
 * @param {string | null | undefined} runtime
 */
export function isSessionWslDockerRuntime(runtime) {
  return isWslDockerKvmRuntime(toDockerManagerRuntime(runtime))
}

/**
 * Docker options object for dockerManager APIs.
 * @param {string | null | undefined} sessionRuntime
 */
export function sessionDockerOptions(sessionRuntime) {
  const managerRuntime = toDockerManagerRuntime(sessionRuntime)
  if (isWslDockerKvmRuntime(managerRuntime)) {
    return { runtime: managerRuntime, dockerRuntime: managerRuntime }
  }
  return {}
}

/**
 * Docker exec options for a running lab session (target + workstation containers).
 * @param {object | null | undefined} session
 */
export function sessionDockerExecOptionsFromSession(session) {
  const runtime =
    session?.helper?.sessionDockerRuntime ?? session?.helper?.workstationDesktopDockerRuntime ?? null
  return sessionDockerOptions(runtime)
}

/**
 * Resolve Docker runtime for an entire lab session (single context for network + all containers).
 * @param {object | null | undefined} workstationProfile
 * @returns {Promise<{ ok: boolean, dockerRuntime: string | null, label: string | null, reason: string | null, wslSnapshot?: object }>}
 */
export async function resolveSessionDockerRuntime(workstationProfile) {
  const isDesktop = isDesktopContainerProfile(workstationProfile)

  if (process.platform === 'win32' && isDesktop) {
    const wsl = await detectWslDockerKvmRuntime()
    if (wsl.available && wsl.runtime === DOCKER_RUNTIME_WSL_KVM) {
      logger.info('sessionDocker', 'Using WSL-backed Docker for desktop lab session', {
        distro: wsl.defaultDistro
      })
      return {
        ok: true,
        dockerRuntime: DOCKER_RUNTIME_WSL,
        label: 'WSL Docker (KVM)',
        reason: null,
        wslSnapshot: wsl
      }
    }

    const hostKvm = await detectHostDockerKvm()
    if (hostKvm.available) {
      logger.info('sessionDocker', 'Using Docker Desktop host CLI for desktop lab session', {
        wslCode: wsl.code ?? null
      })
      return {
        ok: true,
        dockerRuntime: DOCKER_RUNTIME_WINDOWS,
        label: 'Windows Docker (KVM)',
        reason: null,
        wslSnapshot: wsl
      }
    }

    const setupHint =
      'Enable Docker Desktop → Settings → Resources → WSL Integration for your default Linux distro, ' +
      'or choose a Linux Terminal workstation (e.g. Ubuntu Terminal) instead of a Desktop VM.'
    return {
      ok: false,
      dockerRuntime: null,
      label: null,
      reason: [wsl.reason ?? WSL_DOCKER_INTEGRATION_MESSAGE, hostKvm.reason, setupHint]
        .filter(Boolean)
        .join(' '),
      wslSnapshot: wsl
    }
  }

  if (process.platform === 'win32') {
    return {
      ok: true,
      dockerRuntime: DOCKER_RUNTIME_WINDOWS,
      label: 'Windows Docker',
      reason: null
    }
  }

  return {
    ok: true,
    dockerRuntime: DOCKER_RUNTIME_NATIVE_LINUX,
    label: 'Linux Docker',
    reason: null
  }
}

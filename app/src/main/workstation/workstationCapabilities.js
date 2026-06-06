/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import * as dockerManager from '../dockerManager.js'
import { resolveDockerCommand } from '../toolDetection.js'
import { logger } from '../utils/logger.js'
import { getHostOsLabel } from './workstationHostInfo.js'
import {
  buildDockerModeStatus,
  buildWindowsWorkstationCompatibility
} from './windowsContainerSupport.js'
import { detectDockerKvm, normalizeDockerKvmCapability } from './workstationDesktopDiagnostics.js'
import { getDesktopWorkstationsCatalog } from './workstationDesktopConfig.js'
import { detectWslEnvironment } from '../wsl/wslDetection.js'

const execFileAsync = promisify(execFile)

/** @type {object | null} */
let cachedCapabilities = null
/** @type {number} */
let cachedAt = 0
const CACHE_MS = 30_000

/**
 * @param {string} dockerBin
 */
async function detectDockerOsTypes(dockerBin) {
  const result = { linux: false, windows: false, serverOs: 'unknown' }
  try {
    const { stdout } = await execFileAsync(dockerBin, ['info', '--format', '{{.OSType}}'], {
      timeout: 12_000,
      windowsHide: true
    })
    result.serverOs = String(stdout).trim().toLowerCase() || 'unknown'
    result.linux = result.serverOs === 'linux'
    result.windows = result.serverOs === 'windows'
  } catch (error) {
    logger.info('workstation', 'docker info OSType detection failed', {
      message: error instanceof Error ? error.message : String(error)
    })
  }
  return result
}

/**
 * @param {{ refresh?: boolean }} [options]
 */
export async function detectWorkstationCapabilities(options = {}) {
  const now = Date.now()
  if (!options.refresh && cachedCapabilities && now - cachedAt < CACHE_MS) {
    return cachedCapabilities
  }

  const dockerBin = await resolveDockerCommand()
  const dockerCheck = dockerBin ? await dockerManager.checkReady().catch(() => ({ ready: false })) : { ready: false }
  const dockerReady = Boolean(dockerCheck?.ready)

  let dockerOs = { linux: false, windows: false, serverOs: 'unknown' }
  if (dockerBin && dockerReady) {
    dockerOs = await detectDockerOsTypes(dockerBin)
  }

  const hostInfo = getHostOsLabel()
  const base = {
    hostOs: process.platform,
    isWindowsHost: process.platform === 'win32',
    hostOsLabel: hostInfo.label,
    dockerReady,
    dockerLinuxContainers: dockerReady && dockerOs.linux === true,
    dockerWindowsContainers: dockerReady && dockerOs.windows === true,
    dockerServerOs: dockerOs.serverOs
  }

  const dockerMode = buildDockerModeStatus(base)
  const windowsWorkstation = buildWindowsWorkstationCompatibility(base)

  let dockerKvm = normalizeDockerKvmCapability({
    available: false,
    code: 'kvm_not_checked',
    reason: null,
    report: null
  })
  if (dockerReady && (dockerOs.linux === true || process.platform === 'win32')) {
    try {
      dockerKvm = normalizeDockerKvmCapability(await detectDockerKvm())
    } catch (error) {
      logger.info('workstation', 'KVM detection failed', {
        message: error instanceof Error ? error.message : String(error)
      })
      dockerKvm = normalizeDockerKvmCapability({
        available: false,
        code: 'kvm_probe_failed',
        reason: null,
        report: null
      })
    }
  }

  const desktopContainerOk =
    dockerReady && dockerKvm.available && (dockerOs.linux === true || dockerKvm.runtime === 'docker-wsl-kvm')

  const desktopCatalog = getDesktopWorkstationsCatalog()

  let wslEnv = { installed: false, wsl2Available: false }
  if (process.platform === 'win32') {
    try {
      wslEnv = await detectWslEnvironment()
    } catch {
      wslEnv = { installed: false, wsl2Available: false }
    }
  }

  const capabilities = {
    ...base,
    dockerMode: dockerMode.mode,
    dockerModeLabel: dockerMode.modeLabel,
    windowsWorkstation,
    dockerKvm,
    wsl: wslEnv,
    providers: {
      'docker-linux-terminal': dockerReady && dockerOs.linux === true,
      'docker-windows-terminal':
        process.platform === 'win32' && dockerReady && dockerOs.windows === true,
      ...Object.fromEntries(
        Object.values(desktopCatalog)
          .filter((entry) => entry?.provider)
          .map((entry) => [
            entry.provider,
            desktopContainerOk && Boolean(entry.image?.trim())
          ])
      ),
      'host-local-terminal': true,
      'host-wsl-terminal':
        process.platform === 'win32' && wslEnv.installed === true && wslEnv.wsl2Available === true
    }
  }

  cachedCapabilities = capabilities
  cachedAt = now
  return capabilities
}

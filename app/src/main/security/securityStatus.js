/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getSafetyModeConfig } from '../utils/sanitize.js'
import { getAllSettings } from '../settingsManager.js'
import * as dockerManager from '../dockerManager.js'
import { getActiveLabIds } from '../labManager.js'

/**
 * Snapshot for Settings → Security panel.
 */
export async function collectSecurityStatus() {
  const safety = getSafetyModeConfig()
  const settings = getAllSettings()
  const docker = await dockerManager.checkReady().catch(() => ({ ready: false, message: 'Unavailable' }))
  const activeSessions = getActiveLabIds().length

  return {
    electron: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preloadBridgeOnly: true,
      label: 'Renderer sandboxed; Node APIs only in main process'
    },
    docker: {
      ready: docker.ready === true,
      message: docker.message ?? null,
      safetyModeEnabled: safety.enabled,
      perSessionNetwork: true,
      privilegedBlocked: safety.blockPrivilegedContainers,
      hostMountsBlocked: safety.blockHostMounts,
      resourceLimits: true,
      activeSessions
    },
    terminal: {
      hostShellBlocked: true,
      dockerExecOnly: true,
      label: 'Lab Terminal attaches to sandbox helper containers only'
    },
    communityLabs: {
      schemaValidated: true,
      safetyScanned: safety.enabled,
      disclaimer:
        'Community labs are user-generated content and are not officially audited. Only import labs from sources you trust.'
    },
    developerMode: settings.developerMode === true,
    cleanup: {
      onQuit: true,
      managedLabels: true,
      label: 'Managed containers, networks, credentials, and SSH keys are removed on quit and failed starts'
    }
  }
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as dockerManager from '../dockerManager.js'
import { logger } from '../utils/logger.js'
import { getWorkstationProvider } from './workstationProviders.js'
import { collectDesktopWorkstationDiagnostics } from './workstationDesktopDiagnostics.js'
import { WorkstationStartError } from './workstationStartError.js'
import { isDesktopContainerProfile } from './workstationDesktopDiagnostics.js'

/**
 * @param {object} params
 * @param {Error} cause
 * @param {object} started
 * @param {object} profile
 * @param {object | null} waitResult
 */
async function throwDesktopStartFailure(params, cause, started, profile, waitResult) {
  const containerId = started?.containerId ?? null
  const containerName = params.containerName ?? started?.containerName ?? null
  const runError =
    cause && typeof cause === 'object' && 'dockerOutput' in cause
      ? String(cause.dockerOutput)
      : cause instanceof Error
        ? cause.message
        : String(cause ?? '')

  const diagnostics = await collectDesktopWorkstationDiagnostics(containerId ?? containerName, {
    containerName,
    containerId,
    image: started?.image ?? profile.image,
    runError,
    waitResult,
    runSpec: started?.runSpec ?? null,
    dockerRuntime: started?.dockerRuntime ?? null
  })

  if (params.partialRef && containerId) {
    params.partialRef.helperContainerId = containerId
    params.partialRef.helperContainerName = containerName
  }

  throw new WorkstationStartError(diagnostics.summary, {
    stage: waitResult?.timedOut ? 'workstation_start_timeout' : 'workstation_start_failed',
    report: diagnostics.report,
    containerId,
    containerName,
    hints: diagnostics.hints
  })
}

/**
 * Build and start an isolated lab workstation for a session.
 * @param {object} params
 */
export async function provisionWorkstation(params) {
  const {
    profile,
    lab,
    labId,
    sessionId,
    containerName,
    networkName,
    networkAlias,
    helperEnv,
    progress,
    credentials,
    workstationCredentials,
    partialRef,
    isoPath,
    dockerRuntime: sessionDockerRuntime
  } = params

  const sessionUser = workstationCredentials ?? credentials

  const isDesktopVm = isDesktopContainerProfile(profile)
  const provider = getWorkstationProvider(profile)

  let started
  try {
    started = await provider.provision({
      profile,
      lab,
      labId,
      sessionId,
      containerName,
      networkName,
      networkAlias,
      helperEnv,
      progress,
      credentials,
      partialRef,
      isoPath,
      dockerRuntime: sessionDockerRuntime
    })
  } catch (error) {
    if (isDesktopVm) {
      await throwDesktopStartFailure(params, error, {}, profile, null)
    }
    throw error
  }

  if (started.kind === 'vm' || started.vmId) {
    return {
      ...started,
      profile,
      provider: provider.id
    }
  }

  if (partialRef && started.containerId) {
    partialRef.helperContainerId = started.containerId
    partialRef.helperContainerName = started.containerName ?? containerName
  }

  const dockerRuntime = started.dockerRuntime ?? sessionDockerRuntime ?? null
  const helperWait = await dockerManager.waitForContainerRunning(started.containerId, {
    timeoutMs: isDesktopVm ? 180_000 : profile.type === 'windows' ? 120_000 : 15_000,
    pollMs: 500,
    logLabel: 'lab-workstation',
    dockerRuntime
  })

  if (!helperWait.running) {
    logger.error('workstation', 'Workstation container failed to start', {
      containerId: started.containerId,
      profileId: profile.id,
      provider: provider.id,
      status: helperWait.status,
      exitCode: helperWait.exitCode,
      timedOut: helperWait.timedOut,
      logs: helperWait.logs?.slice(0, 2000)
    })

    if (isDesktopVm) {
      await throwDesktopStartFailure(
        params,
        helperWait.error ? new Error(helperWait.error) : null,
        started,
        profile,
        helperWait
      )
    }

    throw new Error(
      helperWait.timedOut
        ? 'Lab workstation did not become ready in time.'
        : `Lab workstation failed to start (status: ${helperWait.status ?? 'unknown'}${helperWait.exitCode != null ? `, exit ${helperWait.exitCode}` : ''}).`
    )
  }

  const accessModes = profile.accessModes ?? ['terminal']
  if (sessionUser?.username && provider.ensureSessionUser && accessModes.includes('terminal')) {
    const userOk = await provider.ensureSessionUser({
      containerId: started.containerId,
      username: sessionUser.username,
      password: sessionUser.password,
      profile
    })
    if (!userOk) {
      throw new Error(
        'Generated lab user not detected inside lab workstation. Rebuild the workstation image.'
      )
    }
  }

  return {
    ...started,
    profile,
    provider: provider.id
  }
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as dockerManager from './dockerManager.js'
import {
  collectTargetUserDiagnostics,
  CredentialSetupError,
  CREDENTIAL_SETUP_STAGES,
  credentialSetupUserMessage,
  ensureTargetLabUser,
  LAB_USER_WAIT_ATTEMPTS,
  LAB_USER_WAIT_DELAY_MS,
  applyLabCredentialsInContainer,
  waitForTargetSshd
} from './credentialManager.js'
import {
  applySessionPortPolicy,
  buildInternalLabConnection,
  getInternalLabSshRoute,
  INTERNAL_SSH_CONTAINER_PORT,
  isSshContainerPort,
  labHasSshPort,
  normalizeLabPortDefinitions,
  SANDBOX_SSH_TARGET
} from './labPorts.js'
import { missionCredentialsToEnv, updateMissionSessionCredentials } from './missionSessionCredentials.js'
import { labRequiresWorkstationSelection } from './lab/labMode.js'
import { saveDesktopRecoverySnapshot } from './desktopSetupRecovery.js'
import { getSessionVariation } from './sessionVariationManager.js'
import { buildHelperSshEnv } from './sshSessionManager.js'
import { getAllSettings } from './settingsManager.js'
import {
  attachWorkstationCredentialsToSessionRecord,
  createWorkstationCredentials
} from './workstationCredentials.js'
import { getReservedHostPorts, variationToEnv } from './sessionVariationManager.js'
import {
  TARGET_NETWORK_ALIAS,
  WORKSTATION_NETWORK_ALIAS,
  verifySessionNetworkMembership
} from './sessionNetwork.js'
import { verifySshLabReachability } from './workstation/workstationReachability.js'
import { resolveWorkstationChoice } from './workstationProfiles.js'
import { provisionWorkstation } from './workstation/provisionWorkstation.js'
import { buildWorkstationAccessRoutesFromMappings } from './workstation/workstationAccessRoutes.js'
import { isDesktopContainerProfile } from './workstation/workstationDesktopDiagnostics.js'
import {
  profileRequiresDesktopReadinessWait,
  waitForDesktopWorkstationReady,
  isDesktopReadinessComplete
} from './workstation/workstationReadiness.js'
import { buildContainerName } from './utils/sanitize.js'
import { logger } from './utils/logger.js'
import { WorkstationStartError } from './workstation/workstationStartError.js'
import {
  resolveSessionDockerRuntime,
  sessionDockerOptions,
  toDockerManagerRuntime
} from './sessionDockerRuntime.js'

export const LAB_WORKSTATION_IMAGE = 'sysadmin-game/lab-workstation:latest'
/** @deprecated Use LAB_WORKSTATION_IMAGE */
export const TERMINAL_HELPER_IMAGE = LAB_WORKSTATION_IMAGE
export { TARGET_NETWORK_ALIAS, WORKSTATION_NETWORK_ALIAS }
/** @deprecated Use WORKSTATION_NETWORK_ALIAS */
export const HELPER_NETWORK_ALIAS = WORKSTATION_NETWORK_ALIAS

const NETWORK_IP_RETRY_MS = 500
const NETWORK_IP_MAX_WAIT_MS = 12_000

/**
 * @param {{ targetContainerId: string, targetContainerName: string, networkName: string, labId: string, sessionId: string }} ctx
 */
async function resolveTargetNetworkIp(ctx) {
  const { targetContainerId, targetContainerName, networkName, labId, sessionId, dockerRuntime } = ctx
  const dockerOpts = sessionDockerOptions(dockerRuntime)
  const maxAttempts = Math.ceil(NETWORK_IP_MAX_WAIT_MS / NETWORK_IP_RETRY_MS)

  logger.info('sandboxLab', 'Resolving lab-target IP on private session network', {
    networkName,
    targetContainerId,
    labId,
    sessionId
  })

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const ip =
      (await dockerManager.getContainerNetworkIp(targetContainerId, networkName, dockerOpts)) ??
      (await dockerManager.getContainerNetworkIp(targetContainerName, networkName, dockerOpts))

    if (ip) {
      logger.info('sandboxLab', 'Resolved lab-target internal IP', {
        networkName,
        targetContainerId,
        targetInternalIp: ip,
        attempt
      })
      return ip
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, NETWORK_IP_RETRY_MS))
    }
  }

  logger.warn('sandboxLab', 'Could not resolve lab-target internal IP', {
    networkName,
    targetContainerId,
    labId,
    sessionId,
    waitedMs: NETWORK_IP_MAX_WAIT_MS
  })
  return null
}

/**
 * @param {object} targetResult
 * @param {{ container: number, protocol?: string, purpose?: string }[]} portDefinitions
 */
async function refreshTargetPortMappings(targetResult, portDefinitions, dockerRuntime) {
  const defs = portDefinitions
    .filter((def) => def.exposeToHost === true)
    .map((def) => ({
      container: def.container,
      protocol: def.protocol ?? 'tcp',
      purpose: def.purpose,
      label: def.label,
      hint: def.hint,
      showToUser: def.showToUser,
      spoilLevel: def.spoilLevel,
      locked: false,
      bindAll: def.bindAll === true
    }))
  const dockerOpts = sessionDockerOptions(dockerRuntime)
  return dockerManager.inspectContainerPortMappings(targetResult.containerId, defs, dockerOpts)
}

/**
 * @param {object} params
 */
export async function provisionDockerLabEnvironment(params) {
  const {
    lab,
    labId,
    sessionId,
    image,
    containerName,
    dockerEnv = {},
    networkName,
    credentials,
    variation,
    progress,
    partialRef,
    dockerRuntime: sessionDockerRuntime = null,
    workstationPreference,
    workstationProfileId,
    isoPath,
    selectedWorkstationIsoPath,
    selectedWorkstationIsoType,
    labRootPath
  } = params

  const track = partialRef ?? {}
  track.targetContainerName = containerName
  track.helperContainerName = `sysadmin-game-workstation-${labId}-${sessionId}`

  const settings = getAllSettings()
  const workstationResolution = await resolveWorkstationChoice(settings, lab, undefined, {
    sessionPreference: workstationPreference,
    forcedProfileId: workstationProfileId ?? undefined
  })
  const workstationProfile = workstationResolution.profile
  track.workstationProfileId = workstationProfile.id
  track.workstationSelectionSource = workstationResolution.selectionSource
  track.workstationSessionPreference = workstationPreference ?? workstationResolution.sessionPreference
  track.workstationSelectionReason = workstationResolution.reason
  const isDesktopContainer = isDesktopContainerProfile(workstationProfile)

  let dockerRuntime = sessionDockerRuntime
  if (!dockerRuntime) {
    const runtimeResolution = await resolveSessionDockerRuntime(workstationProfile)
    if (!runtimeResolution.ok) {
      throw new WorkstationStartError(runtimeResolution.reason ?? 'Desktop runtime unavailable.', {
        stage: 'docker_runtime_unavailable',
        report: runtimeResolution.wslSnapshot?.report ?? ''
      })
    }
    dockerRuntime = runtimeResolution.dockerRuntime
  }
  track.sessionDockerRuntime = dockerRuntime
  track.desktopDockerRuntime = isDesktopContainer ? toDockerManagerRuntime(dockerRuntime) : null

  const effectiveIsoPath = selectedWorkstationIsoPath ?? isoPath ?? null
  if (effectiveIsoPath) {
    track.selectedWorkstationIsoPath = effectiveIsoPath
    track.selectedWorkstationIsoType = selectedWorkstationIsoType ?? null
  }
  const credentialEnv = missionCredentialsToEnv(credentials)

  let portDefinitions = applySessionPortPolicy(normalizeLabPortDefinitions(lab.docker?.ports))
  const hasSsh = labHasSshPort(portDefinitions)
  const dockerOpts = sessionDockerOptions(dockerRuntime)

  const portOptions = {
    bindAddress: '127.0.0.1',
    allowLockedHost: false,
    allowPublicBind: false,
    excludeHostPorts: getReservedHostPorts()
  }

  const targetEnv = {
    ...dockerEnv,
    ...credentialEnv,
    ...variationToEnv(variation),
    LAB_ID: labId,
    SGQ_LAB_ID: labId,
    SESSION_ID: sessionId,
    SGQ_SESSION_ID: sessionId
  }

  progress?.emit?.('start_target', { status: 'running' })
  progress?.checkCancel?.()

  logger.info('sandboxLab', 'Starting lab-target on managed session network', {
    networkName,
    labId,
    sessionId,
    targetAlias: TARGET_NETWORK_ALIAS,
    username: credentials.username,
    hasSsh,
    dockerRuntime
  })

  const targetResult = await dockerManager.runContainer({
    name: containerName,
    image,
    labId,
    sessionId,
    resourceRole: dockerManager.ROLE_TARGET,
    runProfile: hasSsh ? 'lab-ssh-target' : 'lab-hardened',
    ports: portDefinitions,
    portOptions,
    env: targetEnv,
    network: networkName,
    networkAliases: [TARGET_NETWORK_ALIAS],
    dockerRuntime: toDockerManagerRuntime(dockerRuntime)
  })
  track.targetContainerId = targetResult.containerId

  progress?.emit?.('start_target', { status: 'success' })

  const targetWait = await dockerManager.waitForContainerRunning(targetResult.containerId, {
    timeoutMs: 30_000,
    pollMs: 500,
    logLabel: 'lab-target',
    dockerRuntime: toDockerManagerRuntime(dockerRuntime)
  })
  if (!targetWait.running) {
    const logs = targetWait.logs?.slice(0, 2000) ?? ''
    logger.error('sandboxLab', 'Lab target container not running', {
      sessionId,
      labId,
      status: targetWait.status,
      exitCode: targetWait.exitCode,
      logs
    })
    throw new Error('Lab target container failed to start. Check Docker logs and rebuild the lab image.')
  }

  progress?.emit?.('apply_credentials', { status: 'running' })
  progress?.checkCancel?.()

  const managerRuntime = toDockerManagerRuntime(dockerRuntime)
  const userSetup = await ensureTargetLabUser(targetResult.containerId, credentials.username, {
    attempts: LAB_USER_WAIT_ATTEMPTS,
    delayMs: LAB_USER_WAIT_DELAY_MS,
    credentials: { username: credentials.username, password: credentials.password },
    dockerRuntime: managerRuntime
  })

  if (!userSetup.ok) {
    const stage = userSetup.stage ?? CREDENTIAL_SETUP_STAGES.UNKNOWN
    const message =
      userSetup.message ??
      credentialSetupUserMessage(stage, userSetup.detail ?? undefined)

    const applyLines = [
      `Stage: ${stage}`,
      userSetup.userExists ? 'Lab user exists in target container.' : 'Lab user not found in target container.',
      `--- applyLabCredentialsInContainer (exit ${userSetup.applyResult?.exitCode ?? '?'}) ---`,
      userSetup.applyResult?.stdout ? `stdout:\n${userSetup.applyResult.stdout}` : '',
      userSetup.applyResult?.stderr ? `stderr:\n${userSetup.applyResult.stderr}` : '',
      '',
      userSetup.live?.report ?? ''
    ].filter(Boolean)

    const report = applyLines.join('\n\n').slice(0, 12000)

    progress?.emit?.('apply_credentials', {
      status: 'error',
      message
    })
    logger.error('sandboxLab', 'Lab credential setup failed', {
      sessionId,
      labId,
      username: credentials.username,
      stage,
      userExists: userSetup.userExists === true,
      applyExitCode: userSetup.applyResult?.exitCode,
      applyStderr: userSetup.applyResult?.stderr?.slice(0, 3000) ?? '',
      applyStdout: userSetup.applyResult?.stdout?.slice(0, 3000) ?? ''
    })

    throw new CredentialSetupError(message, {
      stage,
      detail: userSetup.detail ?? undefined,
      report,
      applyResult: userSetup.applyResult,
      live: userSetup.live,
      userExists: userSetup.userExists === true,
      targetContainerId: targetResult.containerId
    })
  }

  progress?.emit?.('apply_credentials', { status: 'success' })

  progress?.emit?.('start_sshd', { status: 'running', message: 'Starting SSH service…' })
  progress?.checkCancel?.()

  const sshdOk = await waitForTargetSshd(targetResult.containerId, {
    attempts: LAB_USER_WAIT_ATTEMPTS,
    delayMs: LAB_USER_WAIT_DELAY_MS,
    dockerRuntime: managerRuntime
  })
  if (!sshdOk) {
    const diagnostics = await collectTargetUserDiagnostics(
      targetResult.containerId,
      credentials.username
    )
    const message = credentialSetupUserMessage(CREDENTIAL_SETUP_STAGES.SSHD_START_FAILED)
    progress?.emit?.('start_sshd', { status: 'error', message })
    logger.error('sandboxLab', 'sshd not ready on lab-target', {
      sessionId,
      labId,
      diagnostics: diagnostics.report?.slice(0, 3000) ?? ''
    })
    throw new CredentialSetupError(message, {
      stage: CREDENTIAL_SETUP_STAGES.SSHD_START_FAILED,
      report: diagnostics.report?.slice(0, 12000) ?? '',
      userExists: true,
      targetContainerId: targetResult.containerId
    })
  }
  progress?.emit?.('start_sshd', { status: 'success' })

  progress?.emit?.('inspect_ports', { status: 'running' })
  progress?.checkCancel?.()
  targetResult.ports = await refreshTargetPortMappings(targetResult, portDefinitions, dockerRuntime)
  progress?.emit?.('inspect_ports', { status: 'success' })

  let targetInternalIp = null
  if (hasSsh) {
    targetInternalIp = await resolveTargetNetworkIp({
      targetContainerId: targetResult.containerId,
      targetContainerName: containerName,
      networkName,
      labId,
      sessionId,
      dockerRuntime
    })
    if (targetInternalIp) {
      credentials.targetInternalIp = targetInternalIp
      credentials.host = targetInternalIp
      credentials.sshPort = INTERNAL_SSH_CONTAINER_PORT
      updateMissionSessionCredentials(sessionId, {
        targetInternalIp,
        host: targetInternalIp,
        sshPort: INTERNAL_SSH_CONTAINER_PORT,
        sshReady: false
      })
    }
  }

  if (!labRequiresWorkstationSelection(lab)) {
    progress?.emit?.('start_workstation', {
      status: 'success',
      message: 'Lab environment ready — use the integrated terminal (already logged in).'
    })
    const directProfile = {
      id: 'target-direct',
      name: 'Lab server',
      kind: 'linux-terminal',
      provider: 'target-direct',
      type: 'linux',
      accessModes: ['terminal'],
      defaultShell: 'bash',
      terminalShell: '/bin/bash',
      capabilities: ['linux', 'terminal']
    }
    const internalRoute = hasSsh
      ? getInternalLabSshRoute(SANDBOX_SSH_TARGET, INTERNAL_SSH_CONTAINER_PORT, targetInternalIp)
      : null
    const internalConnection = hasSsh
      ? buildInternalLabConnection(
          credentials.username,
          credentials.password,
          targetInternalIp ?? SANDBOX_SSH_TARGET,
          INTERNAL_SSH_CONTAINER_PORT,
          targetInternalIp
        )
      : null
    return {
      credentials,
      variation,
      targetResult,
      helperResult: { containerId: null, name: null, ports: [], accessRoutes: [], desktopUrl: null },
      helperName: track.helperContainerName,
      startupWarnings: [...(workstationResolution.warnings ?? [])],
      hasSsh,
      sshReady: true,
      internalRoute,
      internalConnection,
      targetInternalIp,
      portDefinitions,
      targetPorts: targetResult.ports ?? [],
      isLocalTerminal: false,
      isWslLocalTerminal: false,
      workstationProfile: directProfile,
      workstationResolution: {
        ...workstationResolution,
        selectionSource: 'target-only',
        reason: 'Lab runs directly in the target container (no jump box).'
      },
      selectedWorkstationIsoPath: null,
      selectedWorkstationIsoType: null,
      sessionDockerRuntime: track.sessionDockerRuntime ?? dockerRuntime,
      desktopDockerRuntime: null,
      desktopRuntimeLabel: null,
      workstationReadiness: null,
      workstationCredentials: null,
      targetOnly: true
    }
  }

  /** @type {string[]} */
  const startupWarnings = [...(workstationResolution.warnings ?? [])]
  let sshReady = false

  if (hasSsh && !targetInternalIp) {
    startupWarnings.push(
      'Lab target internal IP was not available on the session network. Rebuild images or restart the lab.'
    )
  }

  const helperName = track.helperContainerName
  const isHostTerminalProfile =
    workstationProfile.provider === 'host-local-terminal' ||
    workstationProfile.provider === 'host-wsl-terminal'
  const workstationCredentials =
    params.workstationCredentials ??
    createWorkstationCredentials({
      sessionId,
      labId,
      displayName: workstationProfile.name ?? 'Lab Workstation',
      settings: getAllSettings(),
      lab,
      accessMethod: isHostTerminalProfile
        ? workstationProfile.provider === 'host-wsl-terminal'
          ? 'wsl'
          : 'local'
        : isDesktopContainer
          ? 'desktop'
          : 'terminal'
    })
  if (isHostTerminalProfile) {
    workstationCredentials.loginRequired = false
    workstationCredentials.loginMode = 'auto-login'
  }
  attachWorkstationCredentialsToSessionRecord(sessionId, workstationCredentials)

  const helperEnv = buildHelperSshEnv({
    username: workstationCredentials.username,
    password: workstationCredentials.password,
    targetInternalIp: targetInternalIp ?? '',
    targetHost: TARGET_NETWORK_ALIAS,
    targetSshPort: INTERNAL_SSH_CONTAINER_PORT,
    workstationProfile
  })

  logger.info('sandboxLab', 'Provisioning lab workstation on managed network', {
    networkName,
    labId,
    sessionId,
    workstationProfile: workstationProfile.id,
    workstationProvider: workstationProfile.provider,
    workstationAlias: WORKSTATION_NETWORK_ALIAS,
    selectionSource: workstationResolution.selectionSource,
    targetContainerId: targetResult.containerId,
    targetInternalIp
  })

  progress?.emit?.('start_workstation', { status: 'running', message: 'Starting lab workstation…' })
  progress?.checkCancel?.()

  const workstationStarted = await provisionWorkstation({
    profile: workstationProfile,
    lab,
    labId,
    labRootPath,
    sessionId,
    containerName: helperName,
    networkName,
    networkAlias: WORKSTATION_NETWORK_ALIAS,
    helperEnv,
    progress,
    credentials,
    workstationCredentials,
    partialRef: track,
    isoPath: effectiveIsoPath,
    dockerRuntime: toDockerManagerRuntime(dockerRuntime)
  })

  const isLocalTerminal = workstationStarted.kind === 'local-terminal'
  const isWslLocalTerminal = workstationStarted.kind === 'wsl-terminal'
  const isHostTerminalWorkstation = isLocalTerminal || isWslLocalTerminal
  const helperResult = {
    containerId: workstationStarted.containerId,
    name: workstationStarted.containerName,
    ports: workstationStarted.ports ?? [],
    desktopUrl: workstationStarted.desktopUrl ?? null,
    accessRoutes: workstationStarted.accessRoutes ?? []
  }
  track.helperContainerId = helperResult.containerId
  if (workstationStarted.dockerRuntime) {
    track.desktopDockerRuntime = workstationStarted.dockerRuntime
  } else if (track.desktopDockerRuntime == null) {
    track.desktopDockerRuntime = toDockerManagerRuntime(dockerRuntime)
  }

  progress?.emit?.('start_workstation', { status: 'success' })

  if (hasSsh && helperResult.containerId && !isHostTerminalWorkstation) {
    progress?.emit?.('network', { status: 'running', message: 'Verifying lab session network…' })
    progress?.checkCancel?.()

    const networkCheck = await verifySessionNetworkMembership({
      networkName,
      containerIds: [targetResult.containerId, helperResult.containerId],
      dockerRuntime
    })
    if (!networkCheck.ok) {
      progress?.emit?.('network', {
        status: 'error',
        message: networkCheck.detail ?? 'Lab containers are not on the same session network.'
      })
      throw new CredentialSetupError(networkCheck.detail ?? 'Lab session network validation failed.', {
        stage: CREDENTIAL_SETUP_STAGES.SSH_ROUTE_FAILED,
        report: JSON.stringify(networkCheck, null, 2)
      })
    }
    progress?.emit?.('network', {
      status: 'success',
      message: networkCheck.subnet
        ? `Lab session network ready (${networkCheck.subnet}).`
        : 'Lab session network ready.'
    })
  }

  let workstationReadiness = null

  if (profileRequiresDesktopReadinessWait(workstationProfile) && helperResult.containerId) {
    const readinessStartedAt = Date.now()
    saveDesktopRecoverySnapshot(sessionId, {
      labId,
      image: track.image ?? image,
      containerName,
      networkName,
      helperContainerId: helperResult.containerId,
      targetContainerId: targetResult.containerId,
      helperName,
      targetInternalIp,
      sshReady,
      hasSsh,
      dockerRuntime: workstationStarted.dockerRuntime ?? track.desktopDockerRuntime ?? null,
      readinessStartedAt,
      workstationProfileId: workstationProfile.id,
      workstationProfileName: workstationProfile.name ?? 'Desktop workstation',
      targetPorts: targetResult.ports ?? [],
      helperPorts: helperResult.ports ?? [],
      variation: getSessionVariation(sessionId),
      startupWarnings,
      isLocalTerminal,
      isWslLocalTerminal,
      workstationPreference: track.workstationSessionPreference ?? workstationPreference ?? null
    })
    workstationReadiness = await waitForDesktopWorkstationReady({
      containerId: helperResult.containerId,
      profile: workstationProfile,
      dockerRuntime: workstationStarted.dockerRuntime ?? track.desktopDockerRuntime ?? null,
      progress,
      startedAtMs: readinessStartedAt,
      sessionId
    })
    if (workstationReadiness.accessRoutes?.length) {
      helperResult.accessRoutes = workstationReadiness.accessRoutes
    }
    if (workstationReadiness.desktopUrl) {
      helperResult.desktopUrl = workstationReadiness.desktopUrl
    }
    track.workstationReadiness = workstationReadiness
    if (!isDesktopReadinessComplete(workstationReadiness.state)) {
      throw new WorkstationStartError(
        'Desktop workstation did not reach the login screen or desktop.',
        {
          stage: 'desktop_readiness_failed',
          hints: ['desktop_not_ready']
        }
      )
    }
  }

  if (hasSsh && !isHostTerminalWorkstation) {
    if (targetInternalIp && helperResult.containerId && userSetup.ok) {
      if (isDesktopContainer) {
        // Desktop VMs (Windows/Linux GUI) are not SSH jump boxes — learners connect from inside the desktop.
        // Target sshd was already verified above; probing route from the VM shell is unreliable and unnecessary.
        sshReady = true
        updateMissionSessionCredentials(sessionId, { sshReady })
        credentials.sshReady = sshReady
        progress?.emit?.('ssh_ready', {
          status: 'success',
          message: 'Lab target SSH is ready — connect from your desktop workstation.'
        })
        logger.info('sandboxLab', 'Skipped workstation SSH route check for desktop workstation', {
          labId,
          sessionId,
          targetInternalIp,
          workstationProfileId: workstationProfile.id
        })
      } else {
        progress?.emit?.('ssh_ready', { status: 'running', message: 'Checking SSH reachability…' })
        progress?.checkCancel?.()

        const routeCheckPlatform =
          workstationProfile.type === 'windows' ? 'windows' : 'linux'

        const reachability = await verifySshLabReachability({
          targetContainerId: targetResult.containerId,
          workstationContainerId: helperResult.containerId,
          targetInternalIp,
          targetHostnames: [TARGET_NETWORK_ALIAS, targetInternalIp].filter(Boolean),
          workstationPlatform: routeCheckPlatform,
          dockerRuntime: managerRuntime
        })
        sshReady = reachability.ok
        updateMissionSessionCredentials(sessionId, { sshReady })
        credentials.sshReady = sshReady

        if (!sshReady) {
          const logOpts = sessionDockerOptions(dockerRuntime)
          const [targetLogs, workstationLogs] = await Promise.all([
            dockerManager.getContainerLogs(targetResult.containerId, { tail: 80, ...logOpts }),
            dockerManager.getContainerLogs(helperResult.containerId, { tail: 40, ...logOpts })
          ])
          const stage = reachability.stage ?? CREDENTIAL_SETUP_STAGES.SSH_ROUTE_FAILED
          const message =
            reachability.message ?? credentialSetupUserMessage(stage, reachability.detail ?? undefined)
          progress?.emit?.('ssh_ready', { status: 'error', message })
          logger.error('sandboxLab', 'SSH reachability check failed', {
            labId,
            sessionId,
            targetInternalIp,
            stage,
            portOpen: reachability.portOpen,
            routeOk: reachability.routeOk,
            sshdListening: reachability.sshdListening,
            detail: reachability.detail
          })
          throw new CredentialSetupError(message, {
            stage,
            detail: reachability.detail ?? undefined,
            report: [
              reachability.report ?? '',
              '',
              '--- target container logs ---',
              targetLogs.logs?.slice(0, 2500) ?? '',
              '',
              '--- workstation container logs ---',
              workstationLogs.logs?.slice(0, 1500) ?? ''
            ]
              .filter(Boolean)
              .join('\n')
              .slice(0, 16000),
            userExists: true,
            targetContainerId: targetResult.containerId
          })
        }

        progress?.emit?.('ssh_ready', { status: 'success' })
        logger.info('sandboxLab', 'SSH reachability verified', {
          labId,
          sessionId,
          targetInternalIp
        })
      }
    } else if (hasSsh) {
      progress?.emit?.('ssh_ready', { status: 'error' })
      throw new CredentialSetupError('Lab target route could not be resolved.', {
        stage: CREDENTIAL_SETUP_STAGES.SSH_ROUTE_FAILED
      })
    }
  }

  const internalRoute = hasSsh
    ? getInternalLabSshRoute(SANDBOX_SSH_TARGET, INTERNAL_SSH_CONTAINER_PORT, targetInternalIp)
    : null
  const internalConnection = hasSsh
    ? buildInternalLabConnection(
        credentials.username,
        credentials.password,
        targetInternalIp ?? SANDBOX_SSH_TARGET,
        INTERNAL_SSH_CONTAINER_PORT,
        targetInternalIp
      )
    : null

  return {
    credentials,
    variation,
    targetResult,
    helperResult,
    helperName,
    startupWarnings,
    hasSsh,
    sshReady,
    internalRoute,
    internalConnection,
    targetInternalIp,
    portDefinitions,
    targetPorts: targetResult.ports ?? [],
    isLocalTerminal,
    isWslLocalTerminal,
    workstationProfile,
    workstationResolution,
    selectedWorkstationIsoPath: effectiveIsoPath,
    selectedWorkstationIsoType: track.selectedWorkstationIsoType ?? null,
    sessionDockerRuntime: track.sessionDockerRuntime ?? dockerRuntime,
    desktopDockerRuntime: workstationStarted.dockerRuntime ?? track.desktopDockerRuntime ?? null,
    desktopRuntimeLabel: workstationStarted.desktopRuntimeLabel ?? null,
    workstationReadiness: track.workstationReadiness ?? null,
    workstationCredentials
  }
}

/**
 * @param {object} provisioned
 * @param {string} containerName
 * @param {string} networkName
 */
export function buildSessionHelperState(provisioned, containerName, networkName) {
  const {
    targetResult,
    helperResult,
    helperName,
    startupWarnings,
    sshReady,
    internalConnection,
    targetInternalIp,
    workstationProfile,
    workstationResolution
  } = provisioned

  const isLocalTerminal =
    workstationProfile?.provider === 'host-local-terminal' ||
    provisioned.isLocalTerminal === true
  const isWslLocalTerminal =
    workstationProfile?.provider === 'host-wsl-terminal' || provisioned.isWslLocalTerminal === true

  return {
    containerName: helperName,
    containerId: helperResult.containerId,
    networkName,
    networkAlias: WORKSTATION_NETWORK_ALIAS,
    isLabEnvironment: provisioned.targetOnly === true,
    workstationImage: workstationProfile?.image ?? LAB_WORKSTATION_IMAGE,
    workstationProfileId: workstationProfile?.id ?? 'ubuntu-terminal',
    workstationProfileName: workstationProfile?.name ?? 'Ubuntu Terminal Workstation',
    workstationKind: workstationProfile?.kind ?? 'linux-terminal',
    workstationProvider: workstationProfile?.provider ?? 'docker-linux-terminal',
    workstationRuntime: isWslLocalTerminal ? 'wsl-terminal' : isLocalTerminal ? 'local-terminal' : 'docker',
    workstationNotSandboxed: isLocalTerminal || isWslLocalTerminal,
    workstationPlatform: workstationProfile?.type === 'windows' ? 'windows' : 'linux',
    workstationAccessModes: workstationProfile?.accessModes ?? ['terminal'],
    workstationAccessRoutes:
      helperResult.accessRoutes?.length > 0
        ? helperResult.accessRoutes
        : buildWorkstationAccessRoutesFromMappings(helperResult.ports ?? []),
    workstationDesktopUrl:
      helperResult.desktopUrl ??
      (() => {
        const routes = helperResult.accessRoutes ?? []
        const novnc = routes.find((r) => r.type === 'novnc')
        if (novnc?.url) return novnc.url
        const web = (helperResult.ports ?? []).find((p) => p.purpose === 'desktop-web')
        const hostPort = web?.host ?? web?.hostPort
        return hostPort ? `http://127.0.0.1:${hostPort}/` : null
      })(),
    sessionDockerRuntime: provisioned.sessionDockerRuntime ?? null,
    workstationDesktopDockerRuntime: provisioned.desktopDockerRuntime ?? null,
    workstationDesktopRuntimeLabel: provisioned.desktopRuntimeLabel ?? null,
    workstationReadiness: provisioned.workstationReadiness ?? null,
    workstationDesktopReady: isDesktopReadinessComplete(provisioned.workstationReadiness?.state),
    workstationSelectionReason: workstationResolution?.reason ?? null,
    workstationSelectionSource: workstationResolution?.selectionSource ?? null,
    workstationSessionPreference:
      workstationResolution?.sessionPreference ?? workstationResolution?.preference ?? null,
    workstationWarnings: workstationResolution?.warnings ?? [],
    workstationDistro: workstationProfile?.distro ?? 'Ubuntu',
    workstationShell: workstationProfile?.defaultShell ?? 'bash',
    workstationTerminalShell: workstationProfile?.terminalShell ?? null,
    workstationTools: workstationProfile?.tools ?? [],
    targetContainerName: containerName,
    targetContainerId: targetResult.containerId,
    targetAliases: [TARGET_NETWORK_ALIAS],
    targetInternalIp: targetInternalIp ?? null,
    targetInternalPort: INTERNAL_SSH_CONTAINER_PORT,
    sshCommand: internalConnection?.command ?? null,
    sshReady: sshReady === true,
    startupWarnings
  }
}

export { buildContainerName }

/*

 * This Source Code Form is subject to the terms of the Mozilla Public

 * License, v. 2.0. If a copy of the MPL was not distributed with this

 * file, You can obtain one at https://mozilla.org/MPL/2.0/.

 */



import * as dockerManager from '../dockerManager.js'
import {
  resolveDesktopViewerUrl,
  getDesktopRuntimeStatusLabel,
  DOCKER_RUNTIME_WSL_KVM,
  DOCKER_RUNTIME_HOST,
  isWslDockerKvmRuntime
} from '../wsl/wslDockerKvm.js'
import { buildWorkstationAccessRoutesFromMappings } from './workstationAccessRoutes.js'

import { ensureWorkstationLabUser } from '../credentialManager.js'

import path from 'path'
import { getLabsPath } from '../utils/paths.js'
import { isCustomWorkstationEnabled } from './workstationCustomProfile.js'

import { logger } from '../utils/logger.js'

import {

  getWorkstationProfileVersion,

  resolveWorkstationBuildContext

} from './workstationCatalog.js'

import { detectWorkstationCapabilities } from './workstationCapabilities.js'

import { getProfileAvailability } from './workstationResolution.js'

import {
  buildDesktopContainerPortSpecs,
  DESKTOP_IMAGE_NOT_CONFIGURED_MESSAGE,
  getWorkstationDesktopConfig,
  resolveDesktopWorkstationProfile
} from './workstationDesktopConfig.js'
import { assertDesktopKvmForProvision } from './workstationDesktopDiagnostics.js'
import { isDesktopContainerProvider } from '@sysadmin-game/shared/workstations/providerUtils.js'



const LINUX_CAP_ADD = ['NET_RAW']



/**

 * @param {object} profile

 */

export function getWorkstationProvider(profile) {

  const key = profile?.provider

  if (key === 'docker-linux-terminal') return dockerLinuxTerminalProvider

  if (key === 'docker-windows-terminal') return dockerWindowsTerminalProvider

  if (key === 'host-local-terminal') return hostLocalTerminalProvider

  if (key === 'host-wsl-terminal') return hostWslTerminalProvider

  if (isDesktopContainerProvider(key)) return desktopContainerProvider

  throw new Error(`Unknown workstation provider: ${key ?? '(missing)'}`)

}



/**

 * @param {object} profile

 */

export async function assertProviderAvailable(profile) {

  const capabilities = await detectWorkstationCapabilities()

  const availability = getProfileAvailability(profile, capabilities)

  if (!availability.available) {

    throw new Error(availability.message ?? `${profile.name} is not available on this system.`)

  }

}



const dockerLinuxTerminalProvider = {

  id: 'docker-linux-terminal',



  /**

   * @param {object} params

   */

  async provision(params) {

    const {

      profile,

      lab,

      labId,

      labRootPath,

      sessionId,

      containerName,

      networkName,

      networkAlias,

      helperEnv,

      progress,

      dockerRuntime: sessionDockerRuntime

    } = params



    const labsRoot = getLabsPath()

    const resolvedLabRoot =
      labRootPath ?? (lab?.id || labId ? path.join(labsRoot, lab?.id ?? labId) : undefined)

    const { buildContext, dockerfilePath } = resolveWorkstationBuildContext(profile, labsRoot, {
      labRootPath: resolvedLabRoot,
      lab
    })

    const image = profile.image

    const version = isCustomWorkstationEnabled(lab)
      ? `custom-${lab?.id ?? labId}`
      : getWorkstationProfileVersion(profile.id)



    progress?.emit?.('build_workstation', {

      status: 'running',

      message: `Building ${profile.name}…`

    })

    progress?.checkCancel?.()



    const exists = await dockerManager.imageExists(image)

    const imageVersion = exists ? await dockerManager.getLabImageEntrypointVersion(image) : null

    const needsRebuild = !exists || imageVersion !== version



    await dockerManager.buildImage(buildContext, image, {

      labId: `workstation-${profile.id}`,

      sessionId,

      resourceRole: dockerManager.ROLE_WORKSTATION,

      lifecycle: dockerManager.LIFECYCLE_EPHEMERAL,

      dockerfile: dockerfilePath,

      noCache: needsRebuild,

      entrypointVersion: version

    })



    progress?.emit?.('build_workstation', {

      status: 'success',

      message: `${profile.name} ready.`

    })



    progress?.emit?.('start_workstation', { status: 'running' })

    progress?.checkCancel?.()



    const customEnv = lab?.workstation?.custom?.environment ?? {}

    const runResult = await dockerManager.runContainer({

      name: containerName,

      image,

      labId,

      sessionId,

      resourceRole: dockerManager.ROLE_WORKSTATION,

      ports: [],

      env: { ...customEnv, ...helperEnv },

      network: networkName,

      networkAliases: [networkAlias],

      capAdd: LINUX_CAP_ADD,

      dockerRuntime: sessionDockerRuntime

    })



    return {

      containerId: runResult.containerId,

      containerName,

      image,

      platform: 'linux',

      accessModes: profile.accessModes ?? ['terminal']

    }

  },



  /**

   * @param {object} params

   */

  async ensureSessionUser(params) {

    const { containerId, username, password } = params

    return ensureWorkstationLabUser(containerId, username, { platform: 'linux', password })

  }

}



const dockerWindowsTerminalProvider = {

  id: 'docker-windows-terminal',



  /**

   * @param {object} params

   */

  async provision(params) {

    const {

      profile,

      lab,

      labId,

      labRootPath,

      sessionId,

      containerName,

      networkName,

      networkAlias,

      helperEnv,

      progress,

      dockerRuntime: sessionDockerRuntime

    } = params



    await assertProviderAvailable(profile)



    const labsRoot = getLabsPath()

    const resolvedLabRoot =
      labRootPath ?? (lab?.id || labId ? path.join(labsRoot, lab?.id ?? labId) : undefined)

    const { buildContext, dockerfilePath } = resolveWorkstationBuildContext(profile, labsRoot, {
      labRootPath: resolvedLabRoot,
      lab
    })

    const image = profile.image

    const version = isCustomWorkstationEnabled(lab)
      ? `custom-${lab?.id ?? labId}`
      : getWorkstationProfileVersion(profile.id)

    const platform = profile.platform ?? 'windows/amd64'



    progress?.emit?.('build_workstation', {

      status: 'running',

      message: `Building ${profile.name} (Windows container)…`

    })

    progress?.checkCancel?.()



    const exists = await dockerManager.imageExists(image)

    const imageVersion = exists ? await dockerManager.getLabImageEntrypointVersion(image) : null

    const needsRebuild = !exists || imageVersion !== version



    await dockerManager.buildImage(buildContext, image, {

      labId: `workstation-${profile.id}`,

      sessionId,

      resourceRole: dockerManager.ROLE_WORKSTATION,

      lifecycle: dockerManager.LIFECYCLE_EPHEMERAL,

      dockerfile: dockerfilePath,

      noCache: needsRebuild,

      entrypointVersion: version,

      platform

    })



    progress?.emit?.('build_workstation', {

      status: 'success',

      message: `${profile.name} ready.`

    })



    progress?.emit?.('start_workstation', { status: 'running' })

    progress?.checkCancel?.()



    logger.info('workstation', 'Starting Windows terminal workstation container', {

      labId,

      sessionId,

      image,

      platform

    })



    const runResult = await dockerManager.runContainer({

      name: containerName,

      image,

      labId,

      sessionId,

      resourceRole: dockerManager.ROLE_WORKSTATION,

      ports: [],

      env: { ...(lab?.workstation?.custom?.environment ?? {}), ...helperEnv },

      network: networkName,

      networkAliases: [networkAlias],

      platform,

      dockerRuntime: sessionDockerRuntime

    })



    return {

      containerId: runResult.containerId,

      containerName,

      image,

      platform: 'windows',

      accessModes: profile.accessModes ?? ['terminal']

    }

  },



  /**

   * @param {object} params

   */

  async ensureSessionUser(params) {

    const { containerId, username, password } = params

    return ensureWorkstationLabUser(containerId, username, { platform: 'windows', password })

  }

}



const desktopContainerProvider = {
  id: 'desktop-container',

  /**
   * @param {object} params
   */
  async provision(params) {
    const {
      profile: rawProfile,
      lab,
      labId,
      sessionId,
      containerName,
      networkName,
      networkAlias,
      progress,
      partialRef,
      dockerRuntime: sessionDockerRuntime
    } = params

    const profile = resolveDesktopWorkstationProfile(rawProfile)
    await assertProviderAvailable(profile)

    const image = profile.image?.trim()
    if (!image) {
      throw new Error(
        `${profile.name ?? 'Desktop workstation'}: ${DESKTOP_IMAGE_NOT_CONFIGURED_MESSAGE} Set an image in config/workstation.desktop.json.`
      )
    }

    const webPort = profile.desktopWebPort ?? getWorkstationDesktopConfig().webViewerPort
    const osFamily = profile.desktopOsFamily ?? (profile.type === 'windows' ? 'windows' : 'linux')
    const isWindows = osFamily === 'windows'
    const portSpecs = buildDesktopContainerPortSpecs(profile.desktopAccessPorts, webPort)

    const windowsDefaults = getWorkstationDesktopConfig()
    const version =
      lab?.workstation?.custom?.environment?.VERSION ??
      profile.desktopDefaultVersion ??
      profile.desktopVersion ??
      windowsDefaults.defaultVersion

    let dockerRuntime = sessionDockerRuntime ?? null
    let kvmMode = sessionDockerRuntime ? 'session' : null
    let kvmProvision = null
    if (!dockerRuntime) {
      kvmProvision = await assertDesktopKvmForProvision()
      dockerRuntime = kvmProvision.dockerRuntime ?? null
      kvmMode = kvmProvision.mode
    }
    const dockerOpts = dockerRuntime ? { runtime: dockerRuntime } : {}

    const labsRoot = getLabsPath()
    const resolvedLabRoot =
      params.labRootPath ?? (lab?.id || labId ? path.join(labsRoot, lab?.id ?? labId) : undefined)

    if (rawProfile?.buildPath) {
      progress?.emit?.('build_workstation', {
        status: 'running',
        message: `Building ${image} from kalilinux/kali-rolling (first run may take several minutes)…`
      })
      progress?.checkCancel?.()

      const { buildContext, dockerfilePath } = resolveWorkstationBuildContext(rawProfile, labsRoot, {
        labRootPath: resolvedLabRoot,
        lab
      })
      const entrypointVersion = getWorkstationProfileVersion(rawProfile.id)
      const exists = await dockerManager.imageExists(image, dockerOpts)
      const imageVersion = exists ? await dockerManager.getLabImageEntrypointVersion(image) : null
      const needsRebuild = !exists || imageVersion !== entrypointVersion

      await dockerManager.buildImage(buildContext, image, {
        labId: `workstation-${rawProfile.id}`,
        sessionId,
        resourceRole: dockerManager.ROLE_WORKSTATION,
        lifecycle: dockerManager.LIFECYCLE_EPHEMERAL,
        dockerfile: dockerfilePath,
        noCache: needsRebuild,
        entrypointVersion,
        dockerRuntime: dockerRuntime ?? undefined
      })
    } else {
      progress?.emit?.('build_workstation', {
        status: 'running',
        message: `Pulling ${image} (${profile.name ?? 'desktop workstation'})…`
      })
      progress?.checkCancel?.()

      const exists = await dockerManager.imageExists(image, dockerOpts)
      if (!exists) {
        try {
          await dockerManager.pullImage(image, dockerOpts)
        } catch (pullError) {
          const msg = pullError instanceof Error ? pullError.message : String(pullError)
          throw new Error(`Failed to pull desktop image (${image}): ${msg}`)
        }
      }
    }

    progress?.emit?.('build_workstation', {
      status: 'success',
      message: `${profile.name} image ready.`
    })

    progress?.emit?.('start_workstation', {
      status: 'running',
      message:
        dockerRuntime === 'docker-wsl-kvm'
          ? `Starting ${profile.name} via WSL Docker (KVM)…`
          : `Starting ${profile.name} (QEMU)…`
    })
    progress?.checkCancel?.()

    /** @type {Record<string, string>} */
    const env = {
      ...(profile.desktopEnvironment ?? {}),
      ...(lab?.workstation?.custom?.environment ?? {})
    }
    if (isWindows && version) {
      env.VERSION = version
    }

    const devices = ['/dev/kvm', '/dev/net/tun']

    const runSpec = {
      createCommand: `docker run -d --network ${networkName} --network-alias ${networkAlias} --privileged ${devices.map((d) => `--device ${d}`).join(' ')} -p 127.0.0.1:<host>:${webPort} ${image}`,
      webPort,
      devices,
      privileged: true,
      publishedPorts: portSpecs.map((p) => `127.0.0.1:<host> -> ${p.container}/tcp (${p.purpose})`)
    }

    logger.info('workstation', 'Starting desktop container workstation', {
      labId,
      sessionId,
      image,
      webPort,
      provider: profile.provider,
      osFamily,
      kvmMode,
      dockerRuntime
    })

    const runResult = await dockerManager.runContainer({
      name: containerName,
      image,
      labId,
      sessionId,
      resourceRole: dockerManager.ROLE_DESKTOP,
      ports: portSpecs,
      portOptions: { bindAddress: '127.0.0.1' },
      env,
      network: networkName,
      networkAliases: [networkAlias],
      runProfile: 'desktop-vm',
      privileged: true,
      devices,
      capAdd: isWindows ? ['NET_ADMIN'] : ['NET_ADMIN'],
      timeoutMs: 300_000,
      dockerRuntime
    })

    if (partialRef) {
      partialRef.helperContainerId = runResult.containerId
      partialRef.helperContainerName = containerName
      partialRef.desktopDockerRuntime = dockerRuntime
    }

    const published = runResult.ports?.find((p) => p.purpose === 'desktop-web')
    const desktopUrl = resolveDesktopViewerUrl(published)

    if (published?.published) {
      runSpec.publishedPorts = [published.published]
    }

    const accessRoutes = buildWorkstationAccessRoutesFromMappings(runResult.ports ?? [], webPort)

    return {
      containerId: runResult.containerId,
      containerName,
      image,
      platform: isWindows ? 'windows' : 'linux',
      accessModes: profile.accessModes ?? ['desktop'],
      ports: runResult.ports ?? [],
      desktopUrl,
      accessRoutes,
      runSpec,
      dockerRuntime,
      desktopRuntimeLabel:
        kvmProvision?.kvm?.desktopRuntimeLabel ??
        (dockerRuntime
          ? getDesktopRuntimeStatusLabel({
              available: true,
              runtime: isWslDockerKvmRuntime(dockerRuntime)
                ? DOCKER_RUNTIME_WSL_KVM
                : DOCKER_RUNTIME_HOST
            })
          : null)
    }
  }
}

const hostWslTerminalProvider = {
  id: 'host-wsl-terminal',

  async provision(params) {
    const { sessionId, containerName, progress } = params
    progress?.emit?.('start_workstation', {
      status: 'success',
      message: 'WSL Local Linux Terminal — use Open WSL Terminal (not sandboxed).'
    })
    return {
      containerId: null,
      containerName: containerName ?? `wsl-terminal-${sessionId}`,
      kind: 'wsl-terminal',
      provider: 'host-wsl-terminal',
      platform: 'wsl',
      accessModes: ['terminal'],
      notSandboxed: true
    }
  },

  async ensureSessionUser() {
    return true
  }
}

const hostLocalTerminalProvider = {

  id: 'host-local-terminal',



  /**

   * No container — user connects from their real host terminal.

   * @param {object} params

   */

  async provision(params) {

    const { sessionId, containerName, progress } = params

    progress?.emit?.('start_workstation', {

      status: 'success',

      message: 'Local Terminal Workstation — use Open Local Terminal (not sandboxed).'

    })

    return {

      containerId: null,

      containerName: containerName ?? `local-terminal-${sessionId}`,

      kind: 'local-terminal',

      provider: 'host-local-terminal',

      platform: 'host',

      accessModes: ['terminal'],

      notSandboxed: true

    }

  },



  async ensureSessionUser() {

    return true

  }

}


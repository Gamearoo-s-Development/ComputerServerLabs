/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  DEFAULT_WORKSTATION_PROFILE_ID,
  WORKSTATION_PREFERENCE_AUTO,
  getWorkstationProfile,
  normalizeProfileId
} from './workstationCatalog.js'
import { detectWorkstationCapabilities } from './workstationCapabilities.js'
import {
  evaluateProfileLabCompatibility,
  normalizeLabWorkstationRequirements
} from './workstationCompatibility.js'
import { isCustomWorkstationEnabled } from './workstationCustomProfile.js'
import {
  buildWindowsModeMismatchReasons,
  getWindowsWorkstationUnavailableMessage
} from './windowsContainerSupport.js'
import {
  DESKTOP_KVM_HELP_TEXT,
  DESKTOP_KVM_UNAVAILABLE_MESSAGE,
  isDesktopContainerProfile,
  isDesktopKvmAvailable
} from './workstationDesktopDiagnostics.js'
import {
  DESKTOP_IMAGE_NOT_CONFIGURED_MESSAGE,
  isDesktopWorkstationImageConfigured,
  resolveDesktopWorkstationProfile
} from './workstationDesktopConfig.js'
import { isDesktopContainerProvider } from '@sysadmin-game/shared/workstations/providerUtils.js'
import { getDesktopRuntimeByProfileId } from './desktopRuntimeManager.js'
import { isSecuritySimulationLab } from '../securitySimulationLab.js'

/**
 * @param {object} profile
 * @param {object} capabilities
 */
export function isProfileAvailableOnHost(profile, capabilities) {
  if (!profile) return false
  if (profile.requiresHostOs && profile.requiresHostOs !== capabilities.hostOs) {
    return false
  }
  const providerKey = profile.provider
  if (providerKey && capabilities.providers?.[providerKey] === false) {
    return false
  }
  if (profile.requiresDockerWindowsContainers && !capabilities.dockerWindowsContainers) {
    return false
  }
  if (profile.provider === 'docker-linux-terminal' && !capabilities.dockerLinuxContainers) {
    return false
  }
  if (isDesktopContainerProfile(profile) && !isDesktopKvmAvailable(capabilities)) {
    return false
  }
  if (profile.provider === 'host-wsl-terminal' && process.platform !== 'win32') {
    return false
  }
  if (profile.provider === 'host-wsl-terminal' && !capabilities.wsl?.wsl2Available) {
    return false
  }
  return true
}

/**
 * @param {object} profile
 * @param {object} capabilities
 */
export function getProfileAvailability(profile, capabilities) {
  if (!profile) {
    return { available: false, message: 'Unknown workstation profile.' }
  }
  const resolved = resolveDesktopWorkstationProfile(profile)

  if (
    profile.provider === 'docker-windows-terminal' ||
    (profile.id === 'windows-terminal' && profile.provider !== 'desktop-container-windows')
  ) {
    const windowsCompat = capabilities.windowsWorkstation
    if (windowsCompat?.available) {
      return { available: true, message: null, reasons: [] }
    }
    const message =
      getWindowsWorkstationUnavailableMessage(capabilities) ??
      windowsCompat?.summary ??
      'Windows container workstation is not available on this system.'
    return {
      available: false,
      message,
      reasons: windowsCompat?.reasons?.length
        ? windowsCompat.reasons
        : buildWindowsModeMismatchReasons()
    }
  }

  if (profile.provider === 'docker-linux-terminal' && !capabilities.dockerLinuxContainers) {
    if (!capabilities.dockerReady) {
      return {
        available: false,
        message: 'Docker is not running. Start Docker Desktop to use Linux container workstations.'
      }
    }
    return {
      available: false,
      message:
        capabilities.dockerServerOs === 'windows'
          ? 'Linux container workstations are unavailable while Docker Desktop is in Windows containers mode. Switch to Linux containers or choose a desktop workstation.'
          : 'Linux Docker workstations are not available on this system.'
    }
  }

  if (isDesktopContainerProfile(resolved)) {
    const runtime = getDesktopRuntimeByProfileId(resolved.id ?? resolved.provider)
    if (runtime?.lastTest?.ok === false) {
      return {
        available: false,
        message:
          runtime.lastTest.message ??
          'Desktop runtime validation failed. Re-test in Settings → Desktop Runtime.',
        reasons: ['desktop_validation_failed']
      }
    }
    if (!capabilities.dockerLinuxContainers) {
      return {
        available: false,
        message:
          capabilities.dockerServerOs === 'windows'
            ? 'Desktop container workstations require Docker Linux containers mode.'
            : 'Desktop container workstations require Docker with Linux containers.',
        reasons: ['docker_linux_mode']
      }
    }
    if (!isDesktopWorkstationImageConfigured(resolved)) {
      return {
        available: false,
        message: `${resolved.name}: ${DESKTOP_IMAGE_NOT_CONFIGURED_MESSAGE} Configure in Settings → Desktop Runtime.`,
        reasons: ['desktop_image_not_configured']
      }
    }
    if (!isDesktopKvmAvailable(capabilities)) {
      return {
        available: false,
        message:
          capabilities.dockerKvm?.desktopRuntimeLabel ??
          capabilities.dockerKvm?.reason ??
          DESKTOP_KVM_UNAVAILABLE_MESSAGE,
        reasons: ['kvm_unavailable', capabilities.dockerKvm?.code].filter(Boolean)
      }
    }
  }

  if (profile.provider === 'host-wsl-terminal' || profile.id === 'wsl-local-terminal') {
    if (process.platform !== 'win32') {
      return {
        available: false,
        message: 'WSL Local Linux Terminal is only available on Windows.',
        reasons: ['not_windows']
      }
    }
    if (!capabilities.wsl?.installed) {
      return {
        available: false,
        message:
          'WSL is not installed. Use Health Checks for setup help (wsl --install in Administrator PowerShell).',
        reasons: ['wsl_missing']
      }
    }
    if (!capabilities.wsl?.wsl2Available) {
      return {
        available: false,
        message: 'WSL 2 is required. Run wsl --set-default-version 2 after installing WSL.',
        reasons: ['wsl2_missing']
      }
    }
  }

  const available = isProfileAvailableOnHost(profile, capabilities)
  return {
    available,
    message: available
      ? null
      : profile.unavailableMessage ?? `${profile.name} is not available on this system.`
  }
}

/**
 * @param {object} profile
 * @param {ReturnType<typeof normalizeLabWorkstationRequirements>} labReq
 * @param {object} [lab]
 */
function assertProfileCompatibleWithLab(profile, labReq, lab) {
  const result = evaluateProfileLabCompatibility(profile, labReq, lab)
  if (!result.compatible) {
    throw new Error(result.message ?? 'This workstation does not meet the lab requirements.')
  }
}

/**
 * @param {string} profileId
 * @param {ReturnType<typeof normalizeLabWorkstationRequirements>} labReq
 * @param {object} capabilities
 */
function findFirstCompatibleProfileId(profileIds, labReq, lab, capabilities) {
  for (const id of profileIds) {
    if (id === 'local-terminal' || id === 'wsl-local-terminal') continue
    if (isDesktopContainerProvider(id) && !isDesktopKvmAvailable(capabilities)) {
      continue
    }
    if (isDesktopContainerProvider(id)) {
      const candidate = resolveDesktopWorkstationProfile(getWorkstationProfile(id, lab))
      if (!isDesktopWorkstationImageConfigured(candidate)) continue
    }
    const profile = getWorkstationProfile(id, lab)
    if (!profile) continue
    const hostOk = isProfileAvailableOnHost(profile, capabilities)
    const labOk = evaluateProfileLabCompatibility(profile, labReq, lab).compatible
    if (hostOk && labOk) return normalizeProfileId(id)
  }
  return null
}

/**
 * @param {{ labWorkstationPreference?: string, labWorkstationProfile?: string }} settings
 * @param {{ workstation?: object }} [lab]
 * @param {object} [capabilities]
 * @param {{ sessionPreference?: string, forcedProfileId?: string }} [options]
 */
export async function resolveWorkstationChoice(settings, lab, capabilities, options = {}) {
  const caps = capabilities ?? (await detectWorkstationCapabilities())
  const labReq = normalizeLabWorkstationRequirements(lab?.workstation, lab)
  const sessionPrefRaw = options.sessionPreference
  const sessionPref =
    sessionPrefRaw != null && sessionPrefRaw !== ''
      ? normalizeProfileId(sessionPrefRaw) ?? WORKSTATION_PREFERENCE_AUTO
      : null
  const settingsPref = normalizeProfileId(
    settings?.labWorkstationPreference ?? settings?.labWorkstationProfile ?? WORKSTATION_PREFERENCE_AUTO
  )

  const forcedProfileId = options.forcedProfileId
    ? normalizeProfileId(options.forcedProfileId)
    : null

  if (forcedProfileId) {
    const profile = getWorkstationProfile(forcedProfileId, lab)
    if (!profile) {
      throw new Error(`Unknown workstation profile: ${forcedProfileId}`)
    }
    const availability = getProfileAvailability(profile, caps)
    if (!availability.available) {
      throw new Error(
        availability.message ??
          `${profile.name} is not available on this system. Install required tools or pick another workstation.`
      )
    }
    assertProfileCompatibleWithLab(profile, labReq, lab)
    return {
      profile,
      availability,
      preference: forcedProfileId,
      sessionPreference: sessionPref && sessionPref !== WORKSTATION_PREFERENCE_AUTO ? sessionPref : forcedProfileId,
      selectionSource: 'session-choice',
      warnings: [],
      reason: `Using workstation selected for this deployment: ${profile.name}.`,
      labWorkstation: labReq
    }
  }

  /** @type {string[]} */
  const warnings = []
  let requestedId = DEFAULT_WORKSTATION_PROFILE_ID
  let selectionSource = 'default'
  const explicitSessionChoice = Boolean(sessionPref && sessionPref !== WORKSTATION_PREFERENCE_AUTO)

  if (labReq.required && labReq.requiredProfile) {
    requestedId = labReq.requiredProfile
    selectionSource = 'lab-required'
  } else if (explicitSessionChoice) {
    requestedId = sessionPref
    selectionSource = 'session-choice'
  } else if (
    sessionPref === WORKSTATION_PREFERENCE_AUTO ||
    (!sessionPref && settingsPref === WORKSTATION_PREFERENCE_AUTO)
  ) {
    if (isSecuritySimulationLab(lab)) {
      const order = [
        labReq.recommended,
        'desktop-container-kali',
        'kali-terminal',
        'ubuntu-terminal',
        'debian-terminal'
      ].filter(Boolean)
      let picked = null
      for (const candidateId of order) {
        const candidate = getWorkstationProfile(candidateId, lab)
        if (!candidate) continue
        const compat = evaluateProfileLabCompatibility(candidate, labReq, lab)
        if (!compat.compatible) continue
        const avail = getProfileAvailability(candidate, caps)
        if (avail.available) {
          picked = candidateId
          break
        }
      }
      requestedId = picked ?? labReq.recommended ?? 'kali-terminal'
      selectionSource = 'security-simulation-recommended'
    } else {
      requestedId = labReq.recommended ?? DEFAULT_WORKSTATION_PROFILE_ID
      selectionSource = sessionPref === WORKSTATION_PREFERENCE_AUTO ? 'session-lab-recommended' : 'lab-recommended'
    }
  } else if (!sessionPref && settingsPref && settingsPref !== WORKSTATION_PREFERENCE_AUTO) {
    requestedId = settingsPref
    selectionSource = 'user-preference'
  }

  let profile = getWorkstationProfile(requestedId, lab)
  let requestedCompat = profile
    ? evaluateProfileLabCompatibility(profile, labReq, lab)
    : { compatible: false }

  if (!requestedCompat.compatible && !explicitSessionChoice) {
    const fallbackCandidates = [
      labReq.recommended,
      ...(isCustomWorkstationEnabled(lab) ? ['custom'] : []),
      ...labReq.supported,
      DEFAULT_WORKSTATION_PROFILE_ID,
      'ubuntu-terminal',
      'debian-terminal',
      'kali-terminal',
      'desktop-container-windows'
    ].filter(Boolean)
    const fallbackId = findFirstCompatibleProfileId(fallbackCandidates, labReq, lab, caps)
    if (fallbackId && fallbackId !== requestedId) {
      warnings.push(
        requestedCompat.message ??
          `Workstation "${requestedId}" does not meet lab requirements; using ${fallbackId}.`
      )
      requestedId = fallbackId
      profile = getWorkstationProfile(requestedId, lab)
      requestedCompat = profile
        ? evaluateProfileLabCompatibility(profile, labReq, lab)
        : { compatible: false }
      selectionSource = 'capability-fallback'
    }
  }

  if (explicitSessionChoice && profile && !requestedCompat.compatible) {
    throw new Error(
      requestedCompat.message ??
        `Workstation "${profile.name}" does not meet the lab requirements.`
    )
  }

  profile = profile ?? getWorkstationProfile(requestedId, lab)
  let availability = getProfileAvailability(profile, caps)

  if (!availability.available) {
    if (explicitSessionChoice) {
      throw new Error(
        availability.message ??
          `Selected workstation "${profile?.name ?? requestedId}" is not available on this system.`
      )
    }
    warnings.push(availability.message ?? `Workstation "${requestedId}" is unavailable on this host.`)
    const fallbackId =
      findFirstCompatibleProfileId(
        [labReq.recommended, DEFAULT_WORKSTATION_PROFILE_ID, 'ubuntu-terminal'],
        labReq,
        lab,
        caps
      ) ?? DEFAULT_WORKSTATION_PROFILE_ID
    profile = getWorkstationProfile(fallbackId, lab)
    availability = getProfileAvailability(profile, caps)
    selectionSource = 'capability-fallback'
    if (!availability.available) {
      const linuxFallback = getWorkstationProfile(DEFAULT_WORKSTATION_PROFILE_ID, lab)
      profile = linuxFallback
      availability = getProfileAvailability(linuxFallback, caps)
      selectionSource = 'linux-fallback'
    }
  }

  if (!profile) {
    throw new Error('No workstation profile could be resolved for this lab session.')
  }

  const reasonParts = []
  if (selectionSource === 'lab-required') {
    reasonParts.push(`This lab requires ${profile.name}.`)
  } else if (selectionSource === 'lab-recommended') {
    reasonParts.push(`Auto selected lab recommendation: ${profile.name}.`)
  } else if (selectionSource === 'user-preference') {
    reasonParts.push(`Using your default workstation preference: ${profile.name}.`)
  } else if (selectionSource === 'session-choice') {
    reasonParts.push(`Using workstation selected for this deployment: ${profile.name}.`)
  } else if (selectionSource === 'session-lab-recommended') {
    reasonParts.push(`Lab Recommended selected: ${profile.name}.`)
  } else if (selectionSource.includes('fallback')) {
    reasonParts.push(`Fell back to ${profile.name}.`)
  }
  if (labReq.reason) {
    reasonParts.push(labReq.reason)
  }
  if (requestedCompat.compatible && requestedCompat.message) {
    warnings.push(requestedCompat.message)
  }

  return {
    profile,
    availability,
    preference: sessionPref ?? settingsPref,
    sessionPreference: sessionPref,
    selectionSource,
    warnings,
    reason: reasonParts.join(' '),
    labWorkstation: labReq
  }
}

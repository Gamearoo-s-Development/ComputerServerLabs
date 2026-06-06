/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  DEFAULT_WORKSTATION_PROFILE_ID,
  WORKSTATION_PREFERENCE_AUTO,
  getWorkstationProfile
} from './workstationCatalog.js'
import { detectDocker } from '../toolDetection.js'
import { detectWorkstationCapabilities } from './workstationCapabilities.js'
import { buildWindowsDockerWslDiagnostics } from '../wsl/wslDockerDiagnostics.js'
import { getProfileAvailability, isProfileAvailableOnHost } from './workstationResolution.js'
import {
  evaluateProfileLabCompatibility,
  normalizeLabWorkstationRequirements
} from './workstationCompatibility.js'
import { getAllSettings } from '../settingsManager.js'
import { isCustomWorkstationEnabled } from './workstationCustomProfile.js'
import { WINDOWS_CONTAINER_SETUP_URL } from './windowsContainerSupport.js'
import {
  DESKTOP_KVM_HELP_TEXT,
  isDesktopContainerProfile,
  isDesktopKvmAvailable
} from './workstationDesktopDiagnostics.js'
import {
  DESKTOP_IMAGE_NOT_CONFIGURED_MESSAGE,
  getDesktopResourceWarningForProfile,
  isDesktopWorkstationImageConfigured,
  resolveDesktopWorkstationProfile
} from './workstationDesktopConfig.js'
import {
  computeDesktopRuntimeStatus,
  DESKTOP_RUNTIME_STATUS,
  getDesktopRuntimeByProfileId
} from './desktopRuntimeManager.js'
import {
  safeIsDesktopContainerProvider
} from '@sysadmin-game/shared/workstations/providerUtils.js'
import { logger } from '../utils/logger.js'

const DEPLOYMENT_OPTIONS = [
  { id: WORKSTATION_PREFERENCE_AUTO, name: 'Lab Recommended', kind: 'auto', section: 'recommended' },
  { id: 'ubuntu-terminal', name: 'Docker Ubuntu Terminal', kind: 'docker-linux', section: 'recommended' },
  { id: 'debian-terminal', name: 'Docker Debian Terminal', kind: 'docker-linux', section: 'recommended' },
  {
    id: 'desktop-container-ubuntu',
    name: 'Ubuntu Desktop Workstation',
    kind: 'docker-desktop',
    section: 'advanced-desktop',
    advancedOnly: true
  },
  {
    id: 'desktop-container-debian',
    name: 'Debian Desktop Workstation',
    kind: 'docker-desktop',
    section: 'advanced-desktop',
    advancedOnly: true
  },
  {
    id: 'desktop-container-kali',
    name: 'Kali Desktop Workstation',
    kind: 'docker-desktop',
    section: 'advanced-desktop',
    advancedOnly: true
  },
  {
    id: 'desktop-container-windows',
    name: 'Windows Desktop Workstation',
    kind: 'docker-desktop',
    section: 'advanced-desktop',
    advancedOnly: true
  },
  {
    id: 'wsl-local-terminal',
    name: 'WSL Local Linux Terminal',
    kind: 'host-wsl',
    section: 'advanced',
    advancedOnly: true
  },
  {
    id: 'local-terminal',
    name: 'Local Terminal (not recommended)',
    kind: 'host-terminal',
    section: 'advanced',
    advancedOnly: true
  }
]

const DESKTOP_OPTION_BADGE = {
  badge: 'advanced',
  badgeHint: 'Runtime: Docker/QEMU · Browser Desktop / VNC / RDP · Requires KVM / WSL KVM'
}

const OPTION_BADGES = {
  'ubuntu-terminal': { badge: 'recommended', badgeHint: 'Most compatible' },
  'debian-terminal': { badge: 'recommended', badgeHint: 'Most compatible' },
  'desktop-container-ubuntu': DESKTOP_OPTION_BADGE,
  'desktop-container-debian': DESKTOP_OPTION_BADGE,
  'desktop-container-kali': DESKTOP_OPTION_BADGE,
  'desktop-container-windows': DESKTOP_OPTION_BADGE,
  'wsl-local-terminal': {
    badge: 'advanced',
    badgeHint: 'Real WSL distro · Not sandboxed · Windows only'
  }
}

/**
 * @param {object} profile
 */
function runtimeNote(profile) {
  if (!profile) return null
  if (profile.provider === 'docker-linux-terminal') return 'Docker Linux container'
  if (isDesktopContainerProfile(profile)) {
    return 'Docker/QEMU · Browser Desktop / VNC / RDP where available'
  }
  if (profile.provider === 'docker-windows-terminal') {
    return 'Windows Server container · Requires Docker Desktop Windows containers mode'
  }
  if (profile.provider === 'host-local-terminal') return 'Your host shell (not sandboxed)'
  if (profile.provider === 'host-wsl-terminal') return 'Your WSL distribution (not sandboxed)'
  return profile.provider ?? null
}

/**
 * @param {ReturnType<typeof normalizeLabWorkstationRequirements>} labReq
 * @param {object} caps
 * @param {object} [lab]
 */
function canAutoDeployWorkstation(labReq, caps, lab) {
  if (labReq.required && labReq.requiredProfile) {
    const reqProfile = getWorkstationProfile(labReq.requiredProfile, lab)
    if (!reqProfile) return false
    return (
      isProfileAvailableOnHost(reqProfile, caps) &&
      evaluateProfileLabCompatibility(reqProfile, labReq, lab).compatible
    )
  }

  const candidates = [
    labReq.recommended,
    ...(isCustomWorkstationEnabled(lab) ? ['custom'] : []),
    ...(labReq.supported ?? []),
    DEFAULT_WORKSTATION_PROFILE_ID,
    'ubuntu-terminal',
    'debian-terminal',
    'desktop-container-ubuntu',
    'desktop-container-debian',
    'desktop-container-kali',
    'desktop-container-windows'
  ].filter(Boolean)

  for (const id of candidates) {
    if (id === 'local-terminal' || id === 'wsl-local-terminal') continue
    if (safeIsDesktopContainerProvider(id) && !isDesktopKvmAvailable(caps)) {
      continue
    }
    if (safeIsDesktopContainerProvider(id)) {
      const candidateProfile = resolveDesktopWorkstationProfile(getWorkstationProfile(id, lab))
      if (!isDesktopWorkstationImageConfigured(candidateProfile)) continue
    }
    const profile = getWorkstationProfile(id, lab)
    if (!profile) continue
    if (!isProfileAvailableOnHost(profile, caps)) continue
    if (!evaluateProfileLabCompatibility(profile, labReq, lab).compatible) continue
    return true
  }
  return false
}

/**
 * @param {object | null} profile
 */
export function workstationRequiresIsoSelection() {
  return false
}

/**
 * Minimal options when deployment evaluation fails (keeps UI usable).
 * @param {object} [lab]
 */
export function buildFallbackWorkstationDeploymentOptions(lab) {
  const recommended = lab?.workstation?.recommended ?? 'ubuntu-terminal'
  const recommendedName =
    getWorkstationProfile(recommended, lab)?.name ?? recommended ?? 'Ubuntu Terminal Workstation'
  return {
    options: [
      {
        id: WORKSTATION_PREFERENCE_AUTO,
        name: 'Lab Recommended',
        kind: 'auto',
        section: 'recommended',
        canDeploy: true,
        disabled: false,
        meetsLabRequirements: true,
        hostAvailable: true,
        available: true,
        hostStatus: 'available',
        notes: [
          'Workstation options could not be fully evaluated. You can still start the lab with recommended defaults.'
        ]
      },
      {
        id: 'ubuntu-terminal',
        name: 'Docker Ubuntu Terminal',
        kind: 'docker-linux',
        section: 'recommended',
        canDeploy: true,
        disabled: false,
        meetsLabRequirements: true,
        hostAvailable: true,
        available: true,
        hostStatus: 'available',
        notes: []
      }
    ],
    environment: {
      hostOs: process.platform,
      hostOsLabel: process.platform,
      dockerReady: false,
      fallback: true,
      recommendedProfileId: recommended,
      recommendedProfileName: recommendedName
    }
  }
}

/**
 * @param {object} [lab]
 */
export async function listWorkstationDeploymentOptions(lab) {
  try {
    return await listWorkstationDeploymentOptionsImpl(lab)
  } catch (error) {
    logger.warn('workstationDeployment', 'Workstation options failed; using fallback', {
      labId: lab?.id,
      error: error instanceof Error ? error.message : String(error)
    })
    return buildFallbackWorkstationDeploymentOptions(lab)
  }
}

/**
 * @param {object} [lab]
 */
async function listWorkstationDeploymentOptionsImpl(lab) {
  const caps = await detectWorkstationCapabilities()
  const settings = getAllSettings()
  const labReq = normalizeLabWorkstationRequirements(lab?.workstation, lab)
  const allowLocalTerminal =
    settings.allowLocalTerminalWorkstation === true && labReq.allowLocalTerminal === true
  const allowWslLocalTerminal =
    settings.allowWslLocalTerminalWorkstation === true && labReq.allowWslLocalTerminal === true
  const requiredProfile = labReq.required ? labReq.requiredProfile : null
  const customEnabled = isCustomWorkstationEnabled(lab)
  const autoDeployOk = canAutoDeployWorkstation(labReq, caps, lab)

  /** @type {typeof DEPLOYMENT_OPTIONS} */
  const optionList = [...DEPLOYMENT_OPTIONS]

  if (customEnabled) {
    const customProfile = getWorkstationProfile('custom', lab)
    optionList.splice(1, 0, {
      id: 'custom',
      name: customProfile?.name ?? 'Custom Lab Workstation',
      kind: customProfile?.type === 'windows' ? 'docker-windows' : 'docker-linux'
    })
  }

  const options = optionList
    .filter((opt) => {
      if (opt.id === 'local-terminal' && !allowLocalTerminal) return false
      if (opt.id === 'wsl-local-terminal' && !allowWslLocalTerminal) return false
      return true
    })
    .map((opt) => {
      const profile =
        opt.id === WORKSTATION_PREFERENCE_AUTO
          ? getWorkstationProfile(labReq.recommended ?? 'ubuntu-terminal', lab)
          : getWorkstationProfile(opt.id, lab)
      const resolvedProfile = profile ? resolveDesktopWorkstationProfile(profile) : null

      const availability = resolvedProfile
        ? getProfileAvailability(resolvedProfile, caps)
        : { available: true, message: null, reasons: [] }

      const labCompat =
        opt.id === WORKSTATION_PREFERENCE_AUTO || !resolvedProfile
          ? { compatible: true, message: null, missingRequired: [], preferredMiss: [] }
          : evaluateProfileLabCompatibility(resolvedProfile, labReq, lab)

      const meetsLabRequirements = labCompat.compatible
      const required = Boolean(requiredProfile && opt.id === requiredProfile)
      const hostDeployAvailable =
        opt.id === WORKSTATION_PREFERENCE_AUTO ? autoDeployOk : availability.available

      let canDeploy = hostDeployAvailable && meetsLabRequirements

      if (requiredProfile) {
        if (opt.id === WORKSTATION_PREFERENCE_AUTO) {
          canDeploy = autoDeployOk
        } else if (opt.id !== requiredProfile) {
          canDeploy = false
        } else {
          canDeploy = availability.available && meetsLabRequirements
        }
      }

      if (opt.id === 'local-terminal') {
        canDeploy = allowLocalTerminal && hostDeployAvailable && meetsLabRequirements
      }

      if (opt.id === 'wsl-local-terminal') {
        canDeploy = allowWslLocalTerminal && hostDeployAvailable && meetsLabRequirements
      }

      if (opt.id === WORKSTATION_PREFERENCE_AUTO && labReq.recommended === 'local-terminal') {
        canDeploy = false
      }

      const disabled = !canDeploy

      /** @type {string[]} */
      const notes = []

      if (opt.id === WORKSTATION_PREFERENCE_AUTO && labReq.recommended) {
        notes.push(
          `Uses lab recommendation: ${getWorkstationProfile(labReq.recommended, lab)?.name ?? labReq.recommended}`
        )
        if (
          safeIsDesktopContainerProvider(labReq.recommended) &&
          !isDesktopKvmAvailable(caps) &&
          autoDeployOk
        ) {
          notes.push(
            'Lab recommends a desktop container workstation, but KVM is not available — a Linux terminal workstation will be used instead.'
          )
        }
      }

      if (labReq.reason && (opt.id === WORKSTATION_PREFERENCE_AUTO || opt.id === labReq.recommended)) {
        notes.push(labReq.reason)
      }

      if (requiredProfile && opt.id === requiredProfile) {
        notes.push('Required for this lab')
      }

      if (opt.id === 'custom' && customEnabled) {
        notes.push(
          'Custom Local Build Image — built from this lab pack. Review generated Dockerfile and files before running.'
        )
        if (lab?.workstation?.reason) {
          notes.push(lab.workstation.reason)
        }
      }

      if (safeIsDesktopContainerProvider(opt.id)) {
        if (!isDesktopWorkstationImageConfigured(resolvedProfile)) {
          notes.push(DESKTOP_IMAGE_NOT_CONFIGURED_MESSAGE)
          notes.push('Set a trusted image in Settings → Desktop Runtime before using this option.')
        } else if (isDesktopKvmAvailable(caps)) {
          notes.push(getDesktopResourceWarningForProfile(opt.id))
          if (caps.dockerKvm?.runtime === 'docker-wsl-kvm') {
            notes.push(`Desktop runtime: ${caps.dockerKvm.desktopRuntimeLabel ?? 'WSL KVM Available'}`)
          }
        } else {
          notes.push(DESKTOP_KVM_HELP_TEXT)
          if (caps.dockerKvm?.desktopRuntimeLabel) {
            notes.push(`Desktop runtime: ${caps.dockerKvm.desktopRuntimeLabel}`)
          }
        }
      }

      if (!meetsLabRequirements && labCompat.message) {
        notes.push(labCompat.message)
      } else if (labCompat.message) {
        notes.push(labCompat.message)
      }

      if (labReq.requiredCapabilities?.length && opt.id !== WORKSTATION_PREFERENCE_AUTO) {
        notes.push(`Lab requires: ${labReq.requiredCapabilities.join(', ')}`)
      }

      const badgeMeta = OPTION_BADGES[opt.id] ?? {}
      const isDesktopOpt = isDesktopContainerProfile(resolvedProfile ?? profile)
      const desktopKvmBlocked = isDesktopOpt && !isDesktopKvmAvailable(caps)
      const desktopImageMissing =
        isDesktopOpt && !isDesktopWorkstationImageConfigured(resolvedProfile ?? profile)

      const runtimeEntry = safeIsDesktopContainerProvider(opt.id)
        ? getDesktopRuntimeByProfileId(opt.id)
        : null
      const runtimeStatus = runtimeEntry ? computeDesktopRuntimeStatus(runtimeEntry, caps) : null
      const desktopStatusLabel =
        runtimeStatus?.status === DESKTOP_RUNTIME_STATUS.AVAILABLE
          ? 'Available'
          : runtimeStatus?.status === DESKTOP_RUNTIME_STATUS.UNAVAILABLE
            ? 'Unavailable'
            : runtimeEntry?.image?.trim()
              ? 'Needs test'
              : 'Needs Image'

      return {
        id: opt.id,
        name: opt.name,
        kind: opt.kind,
        section: opt.section ?? null,
        badge: badgeMeta.badge ?? null,
        badgeHint: badgeMeta.badgeHint ?? null,
        advancedOnly: opt.advancedOnly === true || profile?.advancedOnly === true,
        notRecommended:
          profile?.notRecommended === true ||
          opt.id === 'local-terminal' ||
          opt.id === 'wsl-local-terminal',
        notSandboxed: profile?.notSandboxed === true,
        profileId: profile?.id ?? null,
        hostAvailable: hostDeployAvailable,
        available: hostDeployAvailable,
        hostStatus: hostDeployAvailable ? 'available' : 'unavailable',
        hostStatusReason: desktopImageMissing
          ? DESKTOP_IMAGE_NOT_CONFIGURED_MESSAGE
          : desktopKvmBlocked
            ? 'KVM/nested virtualization unavailable'
            : (availability.message ?? null),
        needsImageConfigured: desktopImageMissing,
        desktopRuntimeStatus: runtimeStatus?.status ?? null,
        desktopStatusLabel,
        desktopRuntimeStatusReason: runtimeStatus?.reason ?? null,
        canDeploy,
        deployBlocked: !canDeploy,
        unavailableMessage: !hostDeployAvailable
          ? availability.message
          : runtimeStatus?.status === DESKTOP_RUNTIME_STATUS.UNAVAILABLE
            ? runtimeStatus.reason
            : null,
        disabledReasons: !hostDeployAvailable ? (availability.reasons ?? []) : [],
        meetsLabRequirements,
        labSupported: meetsLabRequirements,
        compatibilityMessage: labCompat.message,
        missingLabCapabilities: labCompat.missingRequired ?? [],
        labRequiredCapabilities: labReq.requiredCapabilities ?? [],
        labPreferredCapabilities: labReq.preferredCapabilities ?? [],
        required: required || (labReq.required && requiredProfile === opt.id),
        disabled,
        runtimeNote: runtimeNote(profile),
        description: profile?.description ?? null,
        tools: profile?.tools ?? [],
        notes
      }
    })

  const dockerTool = process.platform === 'win32' ? await detectDocker() : null
  const dockerWslDiagnostics =
    process.platform === 'win32'
      ? await buildWindowsDockerWslDiagnostics(caps.wsl, dockerTool ?? undefined)
      : null

  const environment = {
    hostOs: caps.hostOs,
    hostOsLabel: caps.hostOsLabel,
    dockerReady: caps.dockerReady,
    dockerMode: caps.dockerMode,
    dockerModeLabel: caps.dockerModeLabel,
    dockerServerOs: caps.dockerServerOs,
    windowsWorkstation: caps.windowsWorkstation,
    windowsContainerSetupUrl: WINDOWS_CONTAINER_SETUP_URL,
    dockerKvm: caps.dockerKvm,
    desktopKvmHelpText: DESKTOP_KVM_HELP_TEXT,
    wsl: caps.wsl,
    dockerWslDiagnostics
  }

  return { options, environment }
}

/**
 * @param {string} choiceId
 * @param {object[]} options
 */
export function validateWorkstationDeploymentChoice(choiceId, options) {
  const option = options.find((o) => o.id === choiceId)
  if (!option) {
    return { valid: false, message: 'Unknown workstation choice.' }
  }

  if (!option.meetsLabRequirements) {
    return {
      valid: false,
      message:
        option.compatibilityMessage ?? 'This workstation does not meet the lab requirements.'
    }
  }

  if (option.disabled || option.canDeploy === false) {
    return {
      valid: false,
      message:
        option.unavailableMessage ?? option.notes?.join(' ') ?? 'This workstation cannot be used.'
    }
  }

  return { valid: true, option }
}

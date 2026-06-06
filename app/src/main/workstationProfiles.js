/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export {
  DEFAULT_WORKSTATION_PROFILE_ID,
  WORKSTATION_PREFERENCE_AUTO,
  getWorkstationProfile,
  listWorkstationProfiles,
  listPreferenceOptions,
  normalizeLabWorkstationMetadata,
  normalizeProfileId,
  resolveWorkstationBuildContext,
  getWorkstationProfileVersion
} from './workstation/workstationCatalog.js'

export { resolveWorkstationChoice, getProfileAvailability } from './workstation/workstationResolution.js'
export { detectWorkstationCapabilities } from './workstation/workstationCapabilities.js'
export { testWindowsContainerSupport, WINDOWS_CONTAINER_SETUP_URL } from './workstation/windowsContainerSupport.js'
export { getHostOsLabel } from './workstation/workstationHostInfo.js'
export { provisionWorkstation } from './workstation/provisionWorkstation.js'
export {
  listWorkstationDeploymentOptions,
  buildFallbackWorkstationDeploymentOptions,
  validateWorkstationDeploymentChoice
} from './workstation/workstationDeploymentOptions.js'

export {
  evaluateProfileLabCompatibility,
  getProfileCapabilities,
  normalizeLabWorkstationRequirements,
  profileMeetsLabRequirements,
  labNeedsTerminalAccess
} from './workstation/workstationCompatibility.js'

import { listPreferenceOptions, listWorkstationProfiles, getWorkstationProfile } from './workstation/workstationCatalog.js'
import { detectWorkstationCapabilities } from './workstation/workstationCapabilities.js'
import { getProfileAvailability, resolveWorkstationChoice } from './workstation/workstationResolution.js'

/**
 * Settings + IPC payload: preference options and profiles with host availability.
 */
const PREFERENCE_BADGES = {
  'ubuntu-terminal': { badge: 'recommended', badgeHint: 'Most compatible' },
  'debian-terminal': { badge: 'recommended', badgeHint: 'Most compatible' },
  'desktop-container-windows': {
    badge: 'advanced',
    badgeHint: 'Docker/QEMU desktop · Linux containers OK'
  }
}

export async function listWorkstationOptionsForSettings() {
  const capabilities = await detectWorkstationCapabilities()
  const preferenceOptions = listPreferenceOptions().map((option) => {
    if (option.id === 'auto') {
      return { ...option, available: true, badge: null, badgeHint: null, disabledReasons: [] }
    }
    const profile = getWorkstationProfile(option.id)
    const availability = profile
      ? getProfileAvailability(profile, capabilities)
      : { available: false, message: 'Unknown workstation option.', reasons: [] }
    const badgeMeta = PREFERENCE_BADGES[option.id] ?? {}
    return {
      ...option,
      available: availability.available,
      unavailableMessage: availability.message,
      disabledReasons: availability.reasons ?? [],
      badge: badgeMeta.badge ?? null,
      badgeHint: badgeMeta.badgeHint ?? null
    }
  })

  const profiles = listWorkstationProfiles().map((profile) => ({
    ...profile,
    ...getProfileAvailability(profile, capabilities)
  }))

  return {
    preferenceOptions,
    profiles,
    capabilities,
    environment: {
      hostOsLabel: capabilities.hostOsLabel,
      dockerReady: capabilities.dockerReady,
      dockerModeLabel: capabilities.dockerModeLabel,
      windowsWorkstation: capabilities.windowsWorkstation
    }
  }
}

/**
 * @param {{ labWorkstationPreference?: string, labWorkstationProfile?: string }} settings
 * @param {object} [lab]
 */
export async function resolveWorkstationForLab(settings, lab) {
  const resolved = await resolveWorkstationChoice(settings, lab)
  return resolved.profile
}

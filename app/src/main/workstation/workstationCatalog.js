/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { getConfigPath } from '../utils/paths.js'
import { WORKSTATION_PROFILE_VERSIONS } from '../labImageVersion.js'
import {
  resolveCustomWorkstationProfile,
  resolveWorkstationBuildContextForProfile
} from './workstationCustomProfile.js'

export const DEFAULT_WORKSTATION_PROFILE_ID = 'ubuntu-terminal'
export const WORKSTATION_PREFERENCE_AUTO = 'auto'

const LEGACY_PROFILE_MAP = {
  'ubuntu-workstation': 'ubuntu-terminal',
  'debian-workstation': 'debian-terminal',
  'alpine-workstation': 'debian-terminal',
  'windows-workstation': 'desktop-container-windows',
  'windows-terminal': 'desktop-container-windows',
  'kali-workstation': 'ubuntu-terminal',
  'docker-ubuntu-terminal': 'ubuntu-terminal',
  'docker-debian-terminal': 'debian-terminal',
  'vm-ubuntu-workstation': 'ubuntu-terminal',
  'vm-debian-workstation': 'debian-terminal',
  'vm-windows-workstation': 'desktop-container-windows',
  'vm-ubuntu': 'ubuntu-terminal',
  'vm-debian': 'debian-terminal',
  'vm-windows': 'desktop-container-windows',
  'windows-desktop': 'desktop-container-windows',
  'desktop-container-windows': 'desktop-container-windows',
  'desktop-container-linux': 'desktop-container-ubuntu',
  'linux-desktop': 'desktop-container-ubuntu',
  'ubuntu-desktop': 'desktop-container-ubuntu',
  'debian-desktop': 'desktop-container-debian',
  'kali-desktop': 'desktop-container-kali'
}

/** @type {{ defaultProfileId: string, preferenceOptions: object[], profiles: object[] } | null} */
let cachedCatalog = null

function loadCatalogFile() {
  if (cachedCatalog) return cachedCatalog
  const filePath = getConfigPath('workstation.profiles.json')
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  cachedCatalog = {
    defaultProfileId: raw.defaultProfileId ?? DEFAULT_WORKSTATION_PROFILE_ID,
    preferenceOptions: Array.isArray(raw.preferenceOptions) ? raw.preferenceOptions : [],
    profiles: Array.isArray(raw.profiles) ? raw.profiles : []
  }
  return cachedCatalog
}

/**
 * @param {string} [id]
 */
export function normalizeProfileId(id) {
  if (!id || typeof id !== 'string') return null
  const trimmed = id.trim()
  return LEGACY_PROFILE_MAP[trimmed] ?? trimmed
}

/**
 * @param {string} profileId
 * @param {object} [lab] When profileId is `custom`, lab.workstation.custom must be enabled.
 */
export function getWorkstationProfile(profileId, lab) {
  const id = normalizeProfileId(profileId)
  if (id === 'custom' && lab) {
    return resolveCustomWorkstationProfile(lab)
  }
  return loadCatalogFile().profiles.find((profile) => profile.id === id) ?? null
}

export function listWorkstationProfiles() {
  return loadCatalogFile().profiles.map((profile) => ({
    ...profile,
    entrypointVersion: WORKSTATION_PROFILE_VERSIONS[profile.id] ?? null
  }))
}

export function listPreferenceOptions() {
  return loadCatalogFile().preferenceOptions
}

/**
 * @param {object} [labWorkstation]
 */
export function normalizeLabWorkstationMetadata(labWorkstation) {
  if (!labWorkstation || typeof labWorkstation !== 'object') {
    return {
      recommended: null,
      supported: [],
      required: false,
      requiredProfile: null,
      reason: null
    }
  }

  const recommended = normalizeProfileId(
    labWorkstation.recommended ?? labWorkstation.recommendedWorkstation ?? null
  )
  const supportedRaw = labWorkstation.supported ?? labWorkstation.supportedWorkstations ?? []
  const supported = [
    ...new Set(
      supportedRaw
        .map((id) => normalizeProfileId(id))
        .filter(Boolean)
    )
  ]

  let requiredProfile =
    labWorkstation.required === true
      ? normalizeProfileId(
          labWorkstation.requiredProfile ??
            (typeof labWorkstation.required === 'string' ? labWorkstation.required : null) ??
            recommended
        )
      : typeof labWorkstation.required === 'string'
        ? normalizeProfileId(labWorkstation.required)
        : null

  if (
    labWorkstation.required === true &&
    (recommended === 'custom' || labWorkstation.custom?.enabled === true) &&
    !requiredProfile
  ) {
    requiredProfile = 'custom'
  }

  return {
    recommended,
    supported,
    required: labWorkstation.required === true || Boolean(requiredProfile),
    requiredProfile,
    reason: typeof labWorkstation.reason === 'string' ? labWorkstation.reason : null
  }
}

/**
 * @param {object} profile
 * @param {string} labsRoot
 * @param {{ labRootPath?: string, lab?: object }} [options]
 */
export function resolveWorkstationBuildContext(profile, labsRoot, options = {}) {
  if (profile?.custom === true || profile?.id === 'custom') {
    return resolveWorkstationBuildContextForProfile(profile, labsRoot, options)
  }
  const buildPathRel = profile.buildPath ?? '_shared/workstations/ubuntu-workstation'
  const profileDir = path.resolve(labsRoot, buildPathRel)
  // Shared scripts live in _common/; build context must include sibling profile dirs.
  const buildContext = path.resolve(labsRoot, '_shared/workstations')
  const dockerfilePath = path.join(profileDir, 'Dockerfile')
  return { buildContext, dockerfilePath }
}

/**
 * @param {string} profileId
 */
export function getWorkstationProfileVersion(profileId) {
  const id = normalizeProfileId(profileId) ?? DEFAULT_WORKSTATION_PROFILE_ID
  return WORKSTATION_PROFILE_VERSIONS[id] ?? WORKSTATION_PROFILE_VERSIONS[DEFAULT_WORKSTATION_PROFILE_ID]
}

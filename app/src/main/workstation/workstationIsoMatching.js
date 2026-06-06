/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @typedef {{ path: string, name: string, id: string, label: string, sizeLabel?: string, modifiedLabel?: string }} LibraryIso */

/** Accepted ISO type ids per VM workstation profile. */
export const WORKSTATION_ACCEPTED_ISO_TYPES = /** @type {const} */ ({
  'vm-ubuntu': ['ubuntu-server', 'ubuntu-desktop', 'ubuntu'],
  'vm-debian': ['debian'],
  'vm-windows': ['windows-client', 'windows-server', 'windows']
})

/**
 * Map detected ISO hint ids to canonical workstation ISO types.
 * @param {string} isoTypeId
 */
export function normalizeIsoTypeForWorkstation(isoTypeId) {
  const id = String(isoTypeId ?? '').toLowerCase()
  if (id === 'windows' || id === 'win10' || id === 'win11') return 'windows-client'
  if (id === 'windows-server' || id === 'win-server') return 'windows-server'
  if (id === 'ubuntu' && !id.includes('server') && !id.includes('desktop')) return 'ubuntu'
  return id
}

/**
 * @param {string} profileId
 */
export function getAcceptedIsoTypesForWorkstation(profileId) {
  return WORKSTATION_ACCEPTED_ISO_TYPES[profileId] ?? []
}

/**
 * @param {string} profileId
 * @param {string} isoTypeId
 */
export function isoTypeMatchesWorkstation(profileId, isoTypeId) {
  const accepted = getAcceptedIsoTypesForWorkstation(profileId)
  if (!accepted.length) return false
  const normalized = normalizeIsoTypeForWorkstation(isoTypeId)
  const raw = String(isoTypeId ?? '').toLowerCase()

  return accepted.some((type) => {
    if (type === normalized) return true
    if (type === 'ubuntu-server' && (normalized === 'ubuntu-server' || raw === 'ubuntu-server')) {
      return true
    }
    if (type === 'ubuntu-desktop' && (normalized === 'ubuntu-desktop' || raw === 'ubuntu-desktop')) {
      return true
    }
    if (type === 'ubuntu' && (normalized.startsWith('ubuntu') || raw === 'ubuntu')) return true
    if (type === 'debian' && normalized === 'debian') return true
    if (type === 'windows-client' && (normalized === 'windows-client' || raw === 'windows')) {
      return true
    }
    if (
      type === 'windows-server' &&
      (normalized === 'windows-server' || raw === 'windows-server')
    ) {
      return true
    }
    return false
  })
}

/**
 * @param {string} profileId
 * @param {LibraryIso[]} isos
 */
export function listCompatibleIsosForWorkstation(profileId, isos) {
  if (!profileId || !Array.isArray(isos)) return []
  return isos
    .filter((iso) => isoTypeMatchesWorkstation(profileId, iso.id))
    .map((iso) => ({
      ...iso,
      isoType: normalizeIsoTypeForWorkstation(iso.id)
    }))
}

/**
 * @param {string} profileId
 * @param {string} isoPath
 * @param {LibraryIso[]} isos
 */
export function resolveWorkstationIsoSelection(profileId, isoPath, isos) {
  const compatible = listCompatibleIsosForWorkstation(profileId, isos)
  const match = compatible.find((iso) => iso.path === isoPath)
  if (!match) {
    return { valid: false, message: 'Selected ISO is not compatible with this VM workstation.' }
  }
  return {
    valid: true,
    selectedWorkstationIsoPath: match.path,
    selectedWorkstationIsoType: match.isoType
  }
}

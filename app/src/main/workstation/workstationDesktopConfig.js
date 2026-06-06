/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { isDesktopContainerProfile } from './workstationDesktopDiagnostics.js'
import { getDesktopRuntimeByProfileId } from './desktopRuntimeManager.js'
import {
  buildDesktopContainerPortSpecs,
  clearDesktopFileDefaultsCache,
  loadRawDesktopFileDefaults
} from './desktopRuntimeDefaults.js'

export { buildDesktopContainerPortSpecs, loadRawDesktopFileDefaults } from './desktopRuntimeDefaults.js'

export const DESKTOP_IMAGE_NOT_CONFIGURED_MESSAGE = 'Not configured.'

export function clearDesktopConfigCache() {
  clearDesktopFileDefaultsCache()
}

/**
 * @returns {Record<string, object>}
 */
export function getDesktopWorkstationsCatalog() {
  /** @type {Record<string, object>} */
  const catalog = {}
  for (const key of ['ubuntu', 'debian', 'kali', 'windows']) {
    const fileEntry = loadRawDesktopFileDefaults().desktopWorkstations?.[key]
    const provider =
      typeof fileEntry?.provider === 'string'
        ? fileEntry.provider
        : `desktop-container-${key}`
    const runtime = getDesktopRuntimeByProfileId(provider)
    if (runtime?.id) {
      catalog[key] = {
        key,
        id: runtime.id,
        name: runtime.name,
        provider: runtime.provider,
        osFamily: runtime.osFamily,
        image: runtime.image,
        enabled: runtime.enabled,
        trusted: runtime.trusted,
        webViewerPort: runtime.webViewerPort,
        accessPorts: runtime.accessPorts,
        defaultVersion: runtime.defaultVersion,
        environment: runtime.environment ?? {}
      }
    }
  }
  return catalog
}

/**
 * @param {string} profileOrProviderId
 */
export function getDesktopWorkstationConfig(profileOrProviderId) {
  const runtime = getDesktopRuntimeByProfileId(profileOrProviderId)
  if (!runtime) return null
  return {
    id: runtime.id,
    name: runtime.name,
    provider: runtime.provider,
    osFamily: runtime.osFamily,
    image: runtime.image,
    enabled: runtime.enabled,
    trusted: runtime.trusted,
    webViewerPort: runtime.webViewerPort,
    accessPorts: runtime.accessPorts,
    defaultVersion: runtime.defaultVersion,
    environment: runtime.environment ?? {}
  }
}

/**
 * @param {object | null | undefined} profile
 */
export function resolveDesktopWorkstationProfile(profile) {
  if (!profile || !isDesktopContainerProfile(profile)) return profile
  const entry =
    getDesktopWorkstationConfig(profile.id) ?? getDesktopWorkstationConfig(profile.provider)
  if (!entry || entry.enabled === false) {
    return { ...profile, image: entry?.enabled === false ? '' : profile.image ?? '' }
  }

  return {
    ...profile,
    image: entry.image || profile.image || '',
    desktopWebPort: entry.webViewerPort,
    desktopAccessPorts: entry.accessPorts,
    desktopOsFamily: entry.osFamily,
    desktopDefaultVersion: entry.defaultVersion ?? profile.desktopVersion ?? null,
    desktopEnvironment: entry.environment ?? {},
    desktopTrusted: entry.trusted === true
  }
}

/**
 * @param {object | null | undefined} profile
 */
export function isDesktopWorkstationImageConfigured(profile) {
  const runtime = getDesktopRuntimeByProfileId(profile?.id ?? profile?.provider ?? '')
  if (runtime) {
    return runtime.enabled !== false && Boolean(runtime.image?.trim())
  }
  const resolved = resolveDesktopWorkstationProfile(profile)
  return Boolean(resolved?.image?.trim())
}

/**
 * Legacy Windows-only accessor (dockur/windows defaults).
 */
export function getWorkstationDesktopConfig() {
  const entry = getDesktopWorkstationConfig('desktop-container-windows')
  const raw = loadRawDesktopFileDefaults()
  return {
    image: entry?.image || 'dockurr/windows:latest',
    webViewerPort: entry?.webViewerPort ?? 8006,
    defaultVersion: entry?.defaultVersion ?? 'win11',
    allowWithoutKvm: raw.allowWithoutKvm === true,
    resourceWarning:
      typeof raw.resourceWarning === 'string' && raw.resourceWarning.trim()
        ? raw.resourceWarning.trim()
        : 'Desktop workstations are heavier than terminal containers and may require several GB of RAM and disk.',
    kaliResourceWarning:
      typeof raw.kaliResourceWarning === 'string' && raw.kaliResourceWarning.trim()
        ? raw.kaliResourceWarning.trim()
        : 'Kali images are larger and intended for advanced labs.'
  }
}

/**
 * @param {string} [profileId]
 */
export function getDesktopResourceWarningForProfile(profileId) {
  const cfg = getWorkstationDesktopConfig()
  if (profileId === 'desktop-container-kali') {
    return cfg.kaliResourceWarning
  }
  if (profileId === 'desktop-container-windows') {
    return (
      'This uses a Windows VM inside Docker/QEMU. It may need 4GB+ RAM, 20GB+ disk, and hardware virtualization.'
    )
  }
  return cfg.resourceWarning
}

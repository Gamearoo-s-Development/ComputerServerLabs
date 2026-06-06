/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @typedef {import('./providerUtils.types.js').WorkstationProviderId} WorkstationProviderId */

export const DESKTOP_CONTAINER_PROVIDER_IDS = [
  'desktop-container-windows',
  'desktop-container-ubuntu',
  'desktop-container-debian',
  'desktop-container-kali'
]

const TERMINAL_PROFILE_IDS = new Set([
  'ubuntu-terminal',
  'debian-terminal',
  'kali-terminal',
  'windows-terminal',
  'local-terminal',
  'wsl-local-terminal'
])

const TERMINAL_PROVIDER_PREFIXES = [
  'docker-linux-terminal',
  'docker-windows-terminal',
  'host-local-terminal',
  'host-wsl-terminal'
]

const WINDOWS_PROFILE_IDS = new Set(['windows-terminal', 'desktop-container-windows'])
const WINDOWS_PROVIDER_IDS = new Set(['docker-windows-terminal', 'desktop-container-windows'])

const LINUX_PROFILE_IDS = new Set([
  'ubuntu-terminal',
  'debian-terminal',
  'kali-terminal',
  'desktop-container-ubuntu',
  'desktop-container-debian',
  'desktop-container-kali'
])
const LINUX_PROVIDER_IDS = new Set([
  'docker-linux-terminal',
  'desktop-container-ubuntu',
  'desktop-container-debian',
  'desktop-container-kali'
])

/**
 * @param {string | null | undefined} providerId
 */
export function isDesktopContainerProvider(providerId) {
  if (providerId == null || typeof providerId !== 'string') return false
  const id = providerId.trim()
  if (!id) return false
  return id.startsWith('desktop-container-') || DESKTOP_CONTAINER_PROVIDER_IDS.includes(id)
}

/**
 * @param {string | null | undefined} providerId
 */
export function isTerminalWorkstationProvider(providerId) {
  if (providerId == null || typeof providerId !== 'string') return false
  const id = providerId.trim()
  if (!id) return false
  if (isDesktopContainerProvider(id)) return false
  if (TERMINAL_PROFILE_IDS.has(id)) return true
  return TERMINAL_PROVIDER_PREFIXES.some((prefix) => id === prefix || id.startsWith(`${prefix}-`))
}

/**
 * @param {string | null | undefined} providerId
 */
export function isWindowsProvider(providerId) {
  if (providerId == null || typeof providerId !== 'string') return false
  const id = providerId.trim()
  if (!id) return false
  return WINDOWS_PROFILE_IDS.has(id) || WINDOWS_PROVIDER_IDS.has(id)
}

/**
 * @param {string | null | undefined} providerId
 */
export function isLinuxProvider(providerId) {
  if (providerId == null || typeof providerId !== 'string') return false
  const id = providerId.trim()
  if (!id) return false
  if (isWindowsProvider(id)) return false
  return LINUX_PROFILE_IDS.has(id) || LINUX_PROVIDER_IDS.has(id) || id.endsWith('-terminal')
}

/**
 * @param {string | null | undefined} providerId
 */
export function requiresKvm(providerId) {
  return isDesktopContainerProvider(providerId)
}

/**
 * Failsafe wrapper — never throws; returns false when input is invalid.
 * @param {string | null | undefined} providerId
 */
export function safeIsDesktopContainerProvider(providerId) {
  try {
    return isDesktopContainerProvider(providerId)
  } catch {
    return false
  }
}

/**
 * @param {string | null | undefined} providerId
 */
export function safeIsTerminalWorkstationProvider(providerId) {
  try {
    return isTerminalWorkstationProvider(providerId)
  } catch {
    return false
  }
}

/**
 * @param {string | null | undefined} providerId
 */
export function safeRequiresKvm(providerId) {
  try {
    return requiresKvm(providerId)
  } catch {
    return false
  }
}

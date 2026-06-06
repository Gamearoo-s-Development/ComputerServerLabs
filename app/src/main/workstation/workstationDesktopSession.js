/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { isDesktopContainerProfile } from './workstationDesktopDiagnostics.js'
import { isDesktopContainerProvider } from '@sysadmin-game/shared/workstations/providerUtils.js'

export { isDesktopContainerProvider } from '@sysadmin-game/shared/workstations/providerUtils.js'

/**
 * @param {object | null | undefined} helper
 */
export function isDesktopWorkstationHelper(helper) {
  if (isDesktopContainerProvider(helper?.workstationProvider)) return true
  const modes = helper?.workstationAccessModes
  return modes?.includes('desktop') === true && modes?.includes('terminal') !== true
}

/**
 * @param {object | null | undefined} helper
 */
export function isWindowsDesktopWorkstationHelper(helper) {
  if (!isDesktopWorkstationHelper(helper)) return false
  return (
    helper?.workstationProvider === 'desktop-container-windows' ||
    helper?.workstationPlatform === 'windows'
  )
}

/**
 * @param {object | null | undefined} profile
 */
export function isDesktopOnlyWorkstationProfile(profile) {
  if (!profile) return false
  if (!isDesktopContainerProfile(profile)) return false
  const modes = profile.accessModes ?? ['desktop']
  return modes.includes('desktop') && !modes.includes('terminal')
}

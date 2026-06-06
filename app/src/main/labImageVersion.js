/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** Bump when lab Docker entrypoints / credential injection change — triggers image rebuild. */
export const LAB_IMAGE_ENTRYPOINT_VERSION = '2026-05-30-lab-completion-hints'

/** Per-profile workstation image versions — bump to force rebuild. */
export const WORKSTATION_PROFILE_VERSIONS = {
  'ubuntu-terminal': '2026-05-27-ws-profiles',
  'debian-terminal': '2026-05-27-ws-profiles',
  'windows-terminal': '2026-05-27-windows-terminal',
  'windows-desktop': '2026-05-27-windows-desktop-stub',
  'desktop-container-ubuntu': '2026-05-28-desktop-linux',
  'desktop-container-debian': '2026-05-28-desktop-linux',
  'desktop-container-kali': '2026-06-01-kali-rolling-desktop',
  'desktop-container-windows': '2026-05-28-dockurr-windows',
  'ubuntu-workstation': '2026-05-27-ws-profiles',
  'debian-workstation': '2026-05-27-ws-profiles',
  'alpine-workstation': '2026-05-27-ws-profiles'
}

/** @deprecated Use WORKSTATION_PROFILE_VERSIONS['ubuntu-terminal'] */
export const LAB_WORKSTATION_IMAGE_VERSION = WORKSTATION_PROFILE_VERSIONS['ubuntu-terminal']

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import os from 'os'

/**
 * Human-readable host OS label for workstation UX.
 * @param {NodeJS.Platform} [platform]
 * @param {string} [release]
 */
export function getHostOsLabel(platform = process.platform, release = os.release()) {
  if (platform === 'darwin') {
    return { label: 'macOS', platform, release }
  }
  if (platform === 'linux') {
    return { label: 'Linux', platform, release }
  }
  if (platform !== 'win32') {
    return { label: platform, platform, release }
  }

  const parts = String(release).split('.')
  const build = Number(parts[2] ?? 0)
  if (build >= 22000) {
    return { label: 'Windows 11', platform, release, build }
  }
  if (build > 0) {
    return { label: 'Windows 10', platform, release, build }
  }
  return { label: 'Windows', platform, release, build }
}

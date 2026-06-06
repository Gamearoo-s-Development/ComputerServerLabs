/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const WINDOWS_BUILD_DOC = 'docs/windows-build.md'

export const SPECTRE_INSTALLER_COMPONENT =
  'MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libs (Latest)'

/**
 * User-facing message when node-pty / native addons are missing.
 * @param {string} [detail]
 */
export function formatNativeModuleLoadError(detail) {
  const extra = detail ? ` (${detail})` : ''
  return (
    `Sandbox terminal unavailable: native module failed to load${extra}. ` +
    'On Windows, install Visual Studio C++ Spectre-mitigated libraries. ' +
    `See ${WINDOWS_BUILD_DOC}, then run: npm run rebuild:native`
  )
}

/**
 * @param {string} output
 */
export function isSpectreMitigationError(output) {
  return /MSB8040|Spectre-mitigated/i.test(output ?? '')
}

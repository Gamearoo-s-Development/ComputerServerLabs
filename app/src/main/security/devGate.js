/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getAllSettings } from '../settingsManager.js'

export function requireDeveloperMode() {
  if (getAllSettings().developerMode !== true) {
    throw new Error('Developer Mode is required for this action')
  }
}

export function isDeveloperMode() {
  return getAllSettings().developerMode === true
}

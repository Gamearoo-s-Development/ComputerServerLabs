/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { listLabs } from './labManager.js'

/**
 * @returns {{ count: number, ids: string[], validCount: number }}
 */
export function scanInstalledLabs() {
  const { count, labs, validCount } = listLabs()
  return {
    count,
    ids: labs.map((lab) => lab.id),
    validCount: validCount ?? labs.filter((lab) => lab.valid).length
  }
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const DEV = import.meta.env.DEV

/**
 * @param {string} scope
 * @param {unknown[]} args
 */
export function devLog(scope, ...args) {
  if (!DEV) return
  console.debug(`[sysadmin-game:${scope}]`, ...args)
}

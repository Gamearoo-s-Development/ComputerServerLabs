/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export function getApi() {
  return typeof window !== 'undefined' ? window.api ?? null : null
}

export function hasPreloadBridge() {
  return Boolean(getApi()?.system?.ping)
}

export function isLabApiAvailable() {
  const api = getApi()
  return Boolean(api?.labs?.list && api?.labs?.get)
}

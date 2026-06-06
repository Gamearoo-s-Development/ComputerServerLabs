/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * @template T
 * @param {T} data
 */
export function ok(data) {
  return { ok: true, data }
}

/**
 * @param {string} code
 * @param {string} message
 */
export function fail(code, message, extra = {}) {
  return { ok: false, error: { code, message, ...extra } }
}

/**
 * @param {string} scope
 * @param {unknown} error
 * @param {string} [code]
 */
export function fromError(scope, error, code = 'INTERNAL_ERROR') {
  const message = error instanceof Error ? error.message : String(error)
  return fail(code, `${scope}: ${message}`)
}

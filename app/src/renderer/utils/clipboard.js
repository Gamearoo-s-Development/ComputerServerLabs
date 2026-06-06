/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getApi } from '../hooks/useApi.js'

/**
 * @param {string} text
 */
export async function writeClipboardText(text) {
  if (typeof text !== 'string') return
  const api = getApi()
  if (api?.app?.writeClipboardText) {
    const res = await api.app.writeClipboardText(text)
    if (res?.ok === false) {
      throw new Error(res?.error?.message ?? 'Could not write to clipboard')
    }
    return
  }
  await navigator.clipboard.writeText(text)
}

/**
 * @returns {Promise<string>}
 */
export async function readClipboardText() {
  const api = getApi()
  if (api?.app?.readClipboardText) {
    const res = await api.app.readClipboardText()
    if (res?.ok === false) {
      throw new Error(res?.error?.message ?? 'Could not read clipboard')
    }
    return res?.data?.text ?? ''
  }
  return navigator.clipboard.readText()
}

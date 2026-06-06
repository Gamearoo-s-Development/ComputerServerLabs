/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const IP_PATTERN = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g
const PORT_PATTERN = /:\d{2,5}\b/g
// eslint-disable-next-line no-control-regex -- intentional strip of control chars from RPC text
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g

/**
 * Strip secrets, network details, and control characters from RPC-visible text.
 * @param {unknown} value
 * @param {number} [maxLen]
 */
export function sanitizeRpcText(value, maxLen = 120) {
  return String(value ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(IP_PATTERN, '')
    .replace(PORT_PATTERN, '')
    .replace(/\b(password|passwd|token|secret|ssh|flag)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

/**
 * @param {{ page?: string, context?: string, labTitle?: string, completedLab?: string }} payload
 */
export function sanitizeDiscordPresencePayload(payload = {}) {
  return {
    page: payload.page ? sanitizeRpcText(payload.page, 40) : undefined,
    context: payload.context ? sanitizeRpcText(payload.context, 24) : undefined,
    labTitle: payload.labTitle ? sanitizeRpcText(payload.labTitle, 80) : undefined,
    completedLab: payload.completedLab ? sanitizeRpcText(payload.completedLab, 80) : undefined
  }
}

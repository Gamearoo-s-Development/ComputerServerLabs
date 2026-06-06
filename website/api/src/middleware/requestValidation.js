/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** Fields that must never appear in client notification/email requests. */
export const FORBIDDEN_EMAIL_FIELDS = new Set([
  'to',
  'recipient',
  'recipients',
  'email',
  'subject',
  'body',
  'html',
  'text',
  'message',
  'from',
  'sender',
  'smtp',
  'smtpHost',
  'smtpUser',
  'smtpPass',
  'provider',
  'apiKey',
  'resendApiKey',
  'sendgridApiKey',
  'template',
  'templateHtml',
  'templateText',
  'cc',
  'bcc',
  'replyTo'
])

/**
 * @param {object | null | undefined} body
 * @param {string[]} [allowedKeys]
 */
export function assertNoForbiddenEmailFields(body, allowedKeys = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object')
  }
  const allowed = new Set(allowedKeys)
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_EMAIL_FIELDS.has(key)) {
      throw new Error(`Field "${key}" is not allowed`)
    }
    if (allowedKeys.length && !allowed.has(key)) {
      throw new Error(`Unknown field "${key}"`)
    }
  }
}

/**
 * @param {object | null | undefined} body
 * @param {string[]} allowedKeys
 */
export function pickAllowedFields(body, allowedKeys) {
  assertNoForbiddenEmailFields(body, allowedKeys)
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const key of allowedKeys) {
    if (body && Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = body[key]
    }
  }
  return out
}

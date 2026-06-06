/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Scrub known secrets from diagnostic text. Keeps useradd/chpasswd/shell errors visible.
 * @param {string} text
 * @param {string[]} [knownSecrets]
 */
export function scrubSensitiveText(text, knownSecrets = []) {
  if (text == null || text === '') return ''
  let out = String(text)
  for (const secret of knownSecrets) {
    if (typeof secret === 'string' && secret.length >= 4) {
      out = out.split(secret).join('***REDACTED***')
    }
  }
  return out.replace(
    /((?:SGQ_PASSWORD|LAB_PASSWORD|password|passwd|token|secret|key)\s*[=:]\s*)(\S+)/gi,
    '$1***REDACTED***'
  )
}

/**
 * @param {Record<string, unknown>} fields
 * @param {string[]} [knownSecrets]
 */
export function scrubDiagnosticFields(fields, knownSecrets = []) {
  /** @type {Record<string, unknown>} */
  const safe = {}
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      safe[key] = scrubSensitiveText(value, knownSecrets)
    } else if (Array.isArray(value)) {
      safe[key] = value.map((item) =>
        typeof item === 'string' ? scrubSensitiveText(item, knownSecrets) : item
      )
    } else {
      safe[key] = value
    }
  }
  return safe
}

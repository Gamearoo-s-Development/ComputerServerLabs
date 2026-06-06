/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Set a nested field on a lab object using dot-path notation (e.g. docker.image).
 * @param {Record<string, unknown>} lab
 * @param {string} path
 * @param {unknown} value
 */
export function setLabFieldAtPath(lab, path, value) {
  if (!path) return lab
  const parts = path.split('.').filter(Boolean)
  if (parts.length === 0) return lab

  const next = { ...lab }
  let cursor = next
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]
    const child = cursor[key]
    cursor[key] = child && typeof child === 'object' && !Array.isArray(child) ? { ...child } : {}
    cursor = /** @type {Record<string, unknown>} */ (cursor[key])
  }
  cursor[parts[parts.length - 1]] = value
  return next
}

/**
 * @param {HTMLElement | null} target
 */
export function isEditableTarget(target) {
  if (!target) return false
  const tag = target.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return false
}

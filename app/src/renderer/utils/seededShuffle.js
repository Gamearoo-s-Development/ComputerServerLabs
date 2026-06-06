/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Deterministic shuffle for session-scoped UI (command lists, etc.).
 * @template T
 * @param {T[]} items
 * @param {string} seed
 * @returns {T[]}
 */
export function seededShuffle(items, seed) {
  const arr = [...items]
  let state = 0
  for (let i = 0; i < seed.length; i += 1) {
    state = (state ^ seed.charCodeAt(i)) >>> 0
    state = Math.imul(state, 0x01000193) >>> 0
  }
  if (state === 0) state = 0x9e3779b9

  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

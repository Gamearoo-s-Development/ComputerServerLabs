/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const BADGE_LABELS = {
  bundled: 'Bundled with app',
  'catalog-only': 'Catalog download',
  verified: 'Verified',
  official: 'Official',
  community: 'Community',
  unverified: 'Community',
  deprecated: 'Deprecated',
  'security-simulation': 'Security simulation',
  'requires-desktop-runtime': 'Desktop required',
  'docker-only': 'Docker'
}

/** @param {{ isBundled?: boolean, badges?: string[] }} lab */
export function getLabDisplayBadges(lab) {
  /** @type {{ key: string, label: string }[]} */
  const out = []
  const seen = new Set()

  if (lab.isBundled) {
    out.push({ key: 'bundled', label: BADGE_LABELS.bundled })
    seen.add('bundled')
  }

  for (const raw of lab.badges ?? []) {
    if (seen.has(raw)) continue
    if (lab.isBundled && raw === 'official') continue
    seen.add(raw)
    out.push({
      key: raw,
      label: BADGE_LABELS[raw] ?? raw.replace(/-/g, ' ')
    })
  }

  return out
}

/** @param {string} key */
export function badgeClassName(key) {
  if (key === 'bundled') return 'badge badge-bundled'
  if (key === 'catalog-only') return 'badge badge-catalog'
  if (key === 'verified' || key === 'official') return `badge badge-${key}`
  if (key === 'community' || key === 'unverified') return 'badge badge-unverified'
  return 'badge'
}

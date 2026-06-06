/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const TOOL_IDS = [
  'docker',
  'vmware',
  'hyperv',
  'qemu',
  'wsl',
  'virtualization'
]

export const TOOL_CATEGORIES = [
  { id: 'containers', title: 'Containers', description: 'Docker engine and container runtime', ids: ['docker'] },
  {
    id: 'platform',
    title: 'Platform Tools',
    description: 'OS-level virtualization helpers',
    ids: ['wsl', 'virtualization']
  }
]

const TOOL_ICONS = {
  docker: '🐳',
  vmware: '💻',
  hyperv: '🪟',
  qemu: '⚙️',
  wsl: '🐧',
  virtualization: '🔧'
}

export function toolIcon(id) {
  return TOOL_ICONS[id] ?? '🔍'
}

/**
 * @param {string | undefined} status
 * @param {boolean} checking
 */
export function statusDisplayLabel(status, checking = false) {
  if (checking) return 'Checking…'
  if (status === 'installed' || status === 'running') return 'Installed'
  if (status === 'missing') return 'Missing'
  if (status === 'broken') return 'Broken'
  if (status === 'needs_setup') return 'Needs Setup'
  if (status === 'n/a') return 'N/A'
  return status ?? 'Unknown'
}

/**
 * @param {string | undefined} status
 * @param {boolean} checking
 */
export function statusDisplayVariant(status, checking = false) {
  if (checking) return 'checking'
  if (status === 'installed' || status === 'running') return 'success'
  if (status === 'missing') return 'danger'
  if (status === 'broken') return 'warning'
  if (status === 'needs_setup' || status === 'n/a') return 'warning'
  return 'unknown'
}

/**
 * @param {object[]} healthChecks
 */
export function filterToolChecks(healthChecks) {
  return healthChecks.filter((c) => TOOL_IDS.includes(c.id))
}

/**
 * @param {object[]} healthChecks
 */
export function groupToolChecks(healthChecks) {
  const map = new Map(healthChecks.map((c) => [c.id, c]))
  return TOOL_CATEGORIES.map((cat) => ({
    ...cat,
    tools: cat.ids.map((id) => map.get(id)).filter(Boolean)
  })).filter((cat) => cat.tools.length > 0)
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** Private lab session network range — avoids common home/VPN 10.0.0.0/8 overlaps. */
export const SESSION_NETWORK_OCTETS = [10, 50]
export const SESSION_NETWORK_PREFIX = 24
export const SESSION_NETWORK_MIN_INDEX = 1
export const SESSION_NETWORK_MAX_INDEX = 254

export const TARGET_NETWORK_ALIAS = 'lab-target'
export const WORKSTATION_NETWORK_ALIAS = 'lab-workstation'

/**
 * @param {string} sessionId
 */
export function buildSessionNetworkName(sessionId) {
  return `sysadmin-game-net-${sessionId}`
}

/**
 * @param {number} sessionIndex
 */
export function formatSessionSubnet(sessionIndex) {
  const [a, b] = SESSION_NETWORK_OCTETS
  return `${a}.${b}.${sessionIndex}.0/${SESSION_NETWORK_PREFIX}`
}

/**
 * @param {string} cidr
 * @returns {number | null}
 */
export function parseSessionSubnetIndex(cidr) {
  if (!cidr || typeof cidr !== 'string') return null
  const [a, b] = SESSION_NETWORK_OCTETS
  const re = new RegExp(`^${a}\\.${b}\\.(\\d+)\\.0\\/${SESSION_NETWORK_PREFIX}$`)
  const match = re.exec(cidr.trim())
  if (!match) return null
  const index = Number(match[1])
  if (!Number.isFinite(index) || index < SESSION_NETWORK_MIN_INDEX || index > SESSION_NETWORK_MAX_INDEX) {
    return null
  }
  return index
}

/**
 * @param {string} ip
 * @param {string} cidr
 */
export function ipInSessionSubnet(ip, cidr) {
  const index = parseSessionSubnetIndex(cidr)
  if (!index || !ip) return false
  const [a, b] = SESSION_NETWORK_OCTETS
  const prefix = `${a}.${b}.${index}.`
  return ip.startsWith(prefix)
}

/**
 * @param {Set<number>} usedIndexes
 */
export function pickSessionSubnetIndex(usedIndexes) {
  for (let index = SESSION_NETWORK_MIN_INDEX; index <= SESSION_NETWORK_MAX_INDEX; index += 1) {
    if (!usedIndexes.has(index)) return index
  }
  return null
}

/**
 * @param {string[]} subnets
 */
export function collectUsedSessionSubnetIndexes(subnets) {
  /** @type {Set<number>} */
  const used = new Set()
  for (const cidr of subnets) {
    const index = parseSessionSubnetIndex(cidr)
    if (index != null) used.add(index)
  }
  return used
}

/**
 * @param {string | undefined} purpose
 * @param {string | undefined} [serviceName]
 */
export function resolveServiceNetworkAlias(purpose, serviceName) {
  const raw = String(purpose ?? serviceName ?? '')
    .toLowerCase()
    .trim()
  if (!raw) return null
  if (raw === 'web' || raw === 'http' || raw === 'https') return 'web'
  if (raw === 'database' || raw === 'db') return 'db'
  if (raw === 'api') return 'api'
  if (/^[a-z][a-z0-9-]{0,62}$/.test(raw)) return raw
  return null
}

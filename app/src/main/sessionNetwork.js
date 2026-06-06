/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as dockerManager from './dockerManager.js'
import { buildSgqLabels, LIFECYCLE_EPHEMERAL } from './labResourceLabels.js'
import { sessionDockerOptions } from './sessionDockerRuntime.js'
import { logger } from './utils/logger.js'
import {
  TARGET_NETWORK_ALIAS,
  WORKSTATION_NETWORK_ALIAS,
  buildSessionNetworkName,
  collectUsedSessionSubnetIndexes,
  formatSessionSubnet,
  ipInSessionSubnet,
  pickSessionSubnetIndex,
  resolveServiceNetworkAlias
} from '@sysadmin-game/shared/network/sessionNetworkLogic.js'

export {
  TARGET_NETWORK_ALIAS,
  WORKSTATION_NETWORK_ALIAS,
  buildSessionNetworkName,
  resolveServiceNetworkAlias
} from '@sysadmin-game/shared/network/sessionNetworkLogic.js'

/**
 * Create the per-session bridge network on the chosen Docker runtime.
 * @param {{ sessionId: string, labId: string, dockerRuntime?: string | null, lifecycle?: string }} params
 */
export async function createSessionLabNetwork(params) {
  const { sessionId, labId, dockerRuntime = null, lifecycle } = params
  const networkName = buildSessionNetworkName(sessionId)
  const dockerOpts = sessionDockerOptions(dockerRuntime)
  const { subnet, sessionIndex } = await allocateSessionSubnet(dockerRuntime)
  await dockerManager.createBridgeNetwork(networkName, {
    subnet,
    labels: buildSgqLabels({ sessionId, labId, lifecycle: lifecycle ?? LIFECYCLE_EPHEMERAL }),
    ...dockerOpts
  })
  return { networkName, subnet, sessionIndex }
}

/**
 * Pick an unused /24 in 10.50.0.0/16 after scanning existing Docker networks.
 * @param {string | null | undefined} [dockerRuntime]
 */
export async function allocateSessionSubnet(dockerRuntime) {
  const subnets = await dockerManager.listDockerNetworkSubnets(sessionDockerOptions(dockerRuntime))
  const used = collectUsedSessionSubnetIndexes(subnets)
  const index = pickSessionSubnetIndex(used)
  if (index == null) {
    throw new Error('No free lab session subnet available in 10.50.0.0/16')
  }
  const subnet = formatSessionSubnet(index)
  logger.info('sessionNetwork', 'Allocated session subnet', { subnet, sessionIndex: index })
  return { subnet, sessionIndex: index }
}

/**
 * @param {string} networkName
 * @param {string[]} containerIds
 * @param {string | null | undefined} [dockerRuntime]
 */
export async function verifySessionNetworkMembership({ networkName, containerIds, dockerRuntime }) {
  const dockerOpts = sessionDockerOptions(dockerRuntime)
  if (!networkName) {
    return { ok: false, detail: 'Session network name is missing.' }
  }

  const subnet = await dockerManager.getNetworkSubnet(networkName, dockerOpts)
  /** @type {{ containerId: string, ip: string | null }[]} */
  const members = []

  for (const containerId of containerIds.filter(Boolean)) {
    const ip = await dockerManager.getContainerNetworkIp(containerId, networkName, dockerOpts)
    if (!ip) {
      return {
        ok: false,
        detail: `Container is not attached to ${networkName}.`,
        subnet,
        members,
        failedContainerId: containerId
      }
    }
    if (subnet && !ipInSessionSubnet(ip, subnet)) {
      return {
        ok: false,
        detail: `Container IP ${ip} is outside session subnet ${subnet}.`,
        subnet,
        members,
        failedContainerId: containerId
      }
    }
    members.push({ containerId, ip })
  }

  return { ok: true, subnet, members }
}

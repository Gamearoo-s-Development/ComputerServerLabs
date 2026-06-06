/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  collectUsedSessionSubnetIndexes,
  formatSessionSubnet,
  ipInSessionSubnet,
  parseSessionSubnetIndex,
  pickSessionSubnetIndex,
  resolveServiceNetworkAlias,
  TARGET_NETWORK_ALIAS
} from './sessionNetworkLogic.js'
import { buildLabConnectionRoutes } from '../../app/src/main/labConnectionRoutes.js'

describe('sessionNetworkLogic', () => {
  it('formats session subnets in 10.50.0.0/16', () => {
    assert.equal(formatSessionSubnet(12), '10.50.12.0/24')
  })

  it('parses used subnet indexes', () => {
    assert.equal(parseSessionSubnetIndex('10.50.12.0/24'), 12)
    assert.equal(parseSessionSubnetIndex('172.20.0.0/16'), null)
  })

  it('picks the first unused subnet index', () => {
    const used = collectUsedSessionSubnetIndexes(['10.50.1.0/24', '10.50.2.0/24'])
    assert.equal(pickSessionSubnetIndex(used), 3)
  })

  it('checks IP membership in session subnet', () => {
    assert.equal(ipInSessionSubnet('10.50.12.4', '10.50.12.0/24'), true)
    assert.equal(ipInSessionSubnet('172.20.0.2', '10.50.12.0/24'), false)
  })

  it('maps service purposes to network aliases', () => {
    assert.equal(resolveServiceNetworkAlias('web'), 'web')
    assert.equal(resolveServiceNetworkAlias('database'), 'db')
    assert.equal(resolveServiceNetworkAlias('api'), 'api')
  })
})

describe('labConnectionRoutes', () => {
  it('prefers target internal IP for workstation SSH routes', () => {
    const { routes, connection } = buildLabConnectionRoutes({
      credentials: {
        username: 'labuser',
        password: 'secret',
        targetInternalIp: '10.50.12.2'
      },
      internalRoute: {
        host: '10.50.12.2',
        port: 22,
        internalIp: '10.50.12.2',
        networkAlias: TARGET_NETWORK_ALIAS
      },
      ports: [],
      isDesktopWorkstation: false
    })

    assert.equal(routes[0].host, '10.50.12.2')
    assert.equal(routes[0].networkAlias, 'lab-target')
    assert.equal(connection?.host, '10.50.12.2')
    assert.match(connection?.command ?? '', /labuser@10\.50\.12\.2/)
  })

  it('adds Windows desktop fallback route when SSH is published to host', () => {
    const { routes } = buildLabConnectionRoutes({
      credentials: { username: 'labuser', password: 'secret', targetInternalIp: '10.50.12.2' },
      internalRoute: { host: TARGET_NETWORK_ALIAS, port: 22, internalIp: '10.50.12.2' },
      ports: [{ purpose: 'ssh', container: 22, host: 40222, hostPort: 40222 }],
      isDesktopWorkstation: true,
      isWindowsDesktopWorkstation: true
    })

    const fallback = routes.find((r) => r.context === 'desktopFallback')
    assert.ok(fallback)
    assert.equal(fallback.host, 'host.docker.internal')
    assert.equal(fallback.port, 40222)
  })
})

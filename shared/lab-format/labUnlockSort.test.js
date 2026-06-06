/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sortLabsByUnlockOrder } from './labUnlockSort.js'

describe('labUnlockSort', () => {
  const labs = [
    { id: 'nginx-001', unlockRequirements: { minLevel: 3, requiredLabs: ['beginner-linux-001', 'permissions-001'] } },
    { id: 'beginner-linux-001', unlockRequirements: { minLevel: 1 } },
    { id: 'permissions-001', unlockRequirements: { minLevel: 2, requiredLabs: ['beginner-linux-001'] } },
    { id: 'service-repair-001', unlockRequirements: { minLevel: 5 } },
    { id: 'shell-basics-001', unlockRequirements: { minLevel: 1 } }
  ]

  it('orders by unlock progression, not title', () => {
    const sorted = sortLabsByUnlockOrder(labs).map((l) => l.id)
    assert.deepEqual(sorted, [
      'beginner-linux-001',
      'shell-basics-001',
      'permissions-001',
      'nginx-001',
      'service-repair-001'
    ])
  })
})

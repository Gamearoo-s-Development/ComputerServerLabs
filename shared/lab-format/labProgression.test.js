/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildUnlockRequirements, xpForDifficulty } from './labProgression.js'

describe('labProgression', () => {
  const linuxLabs = [{ slug: 'linux-nav-003' }, { slug: 'linux-paths-004' }]

  it('gates first lab in a track on a legacy starter', () => {
    const unlock = buildUnlockRequirements('linux-basics', 'beginner', 0, linuxLabs, true)
    assert.equal(unlock.minLevel, 1)
    assert.deepEqual(unlock.requiredLabs, ['beginner-linux-001'])
  })

  it('chains labs within a track', () => {
    const unlock = buildUnlockRequirements('linux-basics', 'beginner', 1, linuxLabs, true)
    assert.equal(unlock.minLevel, 1)
    assert.deepEqual(unlock.requiredLabs, ['linux-nav-003'])
  })

  it('raises min level for harder tiers and tracks', () => {
    const unlock = buildUnlockRequirements('troubleshooting', 'advanced', 0, [{ slug: 'ts-disk-full-001' }], true)
    assert.equal(unlock.minLevel, 7)
    assert.deepEqual(unlock.requiredLabs, ['service-repair-001'])
  })

  it('maps XP by difficulty', () => {
    assert.equal(xpForDifficulty('Easy'), 50)
    assert.equal(xpForDifficulty('Hard'), 110)
  })
})

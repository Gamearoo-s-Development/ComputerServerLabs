/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildObjectiveHintMap,
  countObjectiveHintsAvailable,
  resolveObjectiveHint
} from './labObjectiveHints.js'

describe('labObjectiveHints', () => {
  const lab = {
    objectivesPublic: [
      { id: 'a', label: 'A', hint: 'Per-step hint A' },
      { id: 'b', label: 'B' }
    ],
    objectives: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    hints: ['Legacy B', 'Legacy C']
  }

  it('prefers objectivesPublic.hint over legacy', () => {
    assert.equal(resolveObjectiveHint(lab, 'a'), 'Per-step hint A')
  })

  it('assigns legacy hints only to objectives without explicit hints', () => {
    assert.equal(resolveObjectiveHint(lab, 'b'), 'Legacy B')
    assert.equal(resolveObjectiveHint(lab, 'c'), 'Legacy C')
  })

  it('counts available hints', () => {
    assert.equal(countObjectiveHintsAvailable(lab), 3)
    assert.equal(Object.keys(buildObjectiveHintMap(lab)).length, 3)
  })
})

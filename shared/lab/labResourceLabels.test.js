/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from 'vitest'
import {
  buildSgqLabels,
  isSgqManagedResource,
  LIFECYCLE_EPHEMERAL,
  LIFECYCLE_PERSISTENT,
  resourceLifecycle,
  resourceSessionId,
  ROLE_TARGET
} from '../../main/labResourceLabels.js'

describe('labResourceLabels', () => {
  it('builds sgq and legacy labels', () => {
    const labels = buildSgqLabels({
      sessionId: 'sess-1',
      labId: 'lab-1',
      role: ROLE_TARGET,
      lifecycle: LIFECYCLE_EPHEMERAL
    })
    expect(labels['sgq.managed']).toBe('true')
    expect(labels['sgq.session']).toBe('sess-1')
    expect(labels['sgq.lab']).toBe('lab-1')
    expect(labels['sgq.role']).toBe('target')
    expect(labels['com.sysadmingame.managed']).toBe('true')
  })

  it('detects managed resources and lifecycle', () => {
    const labels = buildSgqLabels({ lifecycle: LIFECYCLE_PERSISTENT })
    expect(isSgqManagedResource(labels)).toBe(true)
    expect(resourceLifecycle(labels)).toBe(LIFECYCLE_PERSISTENT)
    expect(resourceSessionId(buildSgqLabels({ sessionId: 'abc' }))).toBe('abc')
  })
})

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { setLabFieldAtPath } from './labBuilderFormUtils.js'

describe('setLabFieldAtPath', () => {
  it('updates top-level fields used by Lab Builder form', () => {
    let lab = { title: '', description: '' }
    lab = setLabFieldAtPath(lab, 'title', 'Disk cleanup lab')
    lab = setLabFieldAtPath(lab, 'description', 'Free space on /var')
    assert.equal(lab.title, 'Disk cleanup lab')
    assert.equal(lab.description, 'Free space on /var')
  })

  it('updates nested docker fields', () => {
    let lab = { docker: { image: 'sysadmin-game/lab:latest' } }
    lab = setLabFieldAtPath(lab, 'docker.image', 'sysadmin-game/lab:v2')
    lab = setLabFieldAtPath(lab, 'docker.imageSource', 'prebuilt')
    assert.equal(lab.docker.image, 'sysadmin-game/lab:v2')
    assert.equal(lab.docker.imageSource, 'prebuilt')
  })

  it('updates objective label and hints array', () => {
    let lab = {
      objectives: [{ id: 'done', label: '' }],
      hints: []
    }
    lab = setLabFieldAtPath(lab, 'objectives', [{ id: 'done', label: 'Create completion marker' }])
    lab = setLabFieldAtPath(lab, 'hints', ['Check disk usage with df -h'])
    assert.equal(lab.objectives[0].label, 'Create completion marker')
    assert.deepEqual(lab.hints, ['Check disk usage with df -h'])
  })
})

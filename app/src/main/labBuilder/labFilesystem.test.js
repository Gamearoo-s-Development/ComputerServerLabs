/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  normalizeTargetUser,
  resolveLoginDir,
  syncFilesystemFields,
  validateFilesystemPath,
  buildFilesystemTreePreview
} from './labFilesystem.js'
import { renderTemplateString, buildTemplateContext } from './labTemplateVariables.js'

describe('labFilesystem', () => {
  it('resolves LOGIN_DIR for generated user', () => {
    const tu = normalizeTargetUser({ targetUser: { mode: 'generated-user' } })
    assert.equal(resolveLoginDir(tu, 'alice'), '/home/alice')
  })

  it('resolves LOGIN_DIR for root lab', () => {
    const tu = normalizeTargetUser({ targetUser: { mode: 'root', allowRoot: true } })
    assert.equal(resolveLoginDir(tu, 'ignored'), '/root')
  })

  it('rejects /root paths without root mode', () => {
    const tu = normalizeTargetUser({})
    const check = validateFilesystemPath('/root/secret', tu)
    assert.equal(check.ok, false)
  })

  it('syncs legacy files into filesystem.target', () => {
    const lab = {
      id: 'test-lab',
      files: [{ path: '/home/{{USERNAME}}/notes.txt', content: 'hi', stage: 'runtime' }],
      directories: []
    }
    syncFilesystemFields(lab)
    assert.equal(lab.filesystem.target.files.length, 1)
    assert.equal(lab.files.length, 1)
  })

  it('renders LOGIN_DIR in template context', () => {
    const ctx = buildTemplateContext({
      username: 'bob',
      loginDir: '/home/bob',
      loginUser: 'bob'
    })
    assert.equal(renderTemplateString('{{LOGIN_DIR}}/case.txt', ctx), '/home/bob/case.txt')
  })

  it('builds tree preview lines', () => {
    const lab = {
      id: 'demo',
      filesystem: {
        target: {
          files: [{ path: '{{LOGIN_DIR}}/case-notes.txt', content: 'x', stage: 'runtime' }],
          directories: []
        },
        workstation: { files: [], directories: [] }
      }
    }
    const tree = buildFilesystemTreePreview(lab, { username: 'patchwolf42' })
    assert.ok(tree.target.some((line) => line.includes('case-notes.txt')))
  })
})

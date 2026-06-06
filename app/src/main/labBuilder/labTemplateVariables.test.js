/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildTemplateContext, inferFileStage, renderTemplateString } from './labTemplateVariables.js'

describe('labTemplateVariables', () => {
  it('renders USERNAME in paths', () => {
    const ctx = buildTemplateContext({ username: 'trainee1' })
    assert.equal(renderTemplateString('/home/{{USERNAME}}/welcome.txt', ctx), '/home/trainee1/welcome.txt')
  })

  it('redacts secrets in preview mode', () => {
    const ctx = buildTemplateContext({ password: 'secret123' })
    assert.equal(renderTemplateString('pass={{PASSWORD}}', ctx, { redactSecrets: true }), 'pass=••••••••')
  })

  it('infers runtime stage when variables present', () => {
    assert.equal(inferFileStage({ path: '/home/{{USERNAME}}/x' }), 'runtime')
    assert.equal(inferFileStage({ path: '/var/www/html/index.html', content: 'hi' }), 'build')
  })

  it('renders LOGIN_DIR', () => {
    const ctx = buildTemplateContext({
      username: 'alice',
      loginDir: '/home/alice',
      loginUser: 'alice'
    })
    assert.equal(renderTemplateString('{{LOGIN_DIR}}/notes.txt', ctx), '/home/alice/notes.txt')
  })

  it('renders target connection variables', () => {
    const ctx = buildTemplateContext({
      targetHost: 'lab-target',
      targetIp: '172.20.0.5',
      targetSshPort: '22'
    })
    assert.equal(renderTemplateString('ssh {{USERNAME}}@{{TARGET_HOST}} -p {{TARGET_SSH_PORT}}', ctx),
      'ssh labuser@lab-target -p 22')
    assert.equal(renderTemplateString('ip={{TARGET_IP}}', ctx), 'ip=172.20.0.5')
  })
})

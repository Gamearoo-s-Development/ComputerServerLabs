/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeWorkstationLoginMode,
  resolveWorkstationLoginMode,
  workstationCredentialsVisible,
  workstationLoginGateRequired,
  workstationTerminalUsesTtyLogin
} from './workstationLoginMode.js'

describe('workstationLoginMode', () => {
  it('defaults to tty-login', () => {
    assert.equal(resolveWorkstationLoginMode({}, {}), 'tty-login')
  })

  it('honors lab override', () => {
    assert.equal(resolveWorkstationLoginMode({}, { workstation: { loginMode: 'app-gated' } }), 'app-gated')
  })

  it('maps legacy show-credentials to tty-login', () => {
    assert.equal(normalizeWorkstationLoginMode('show-credentials'), 'tty-login')
    assert.equal(resolveWorkstationLoginMode({ workstationLoginMode: 'show-credentials' }, {}), 'tty-login')
  })

  it('maps legacy none to auto-login', () => {
    assert.equal(normalizeWorkstationLoginMode('none'), 'auto-login')
  })

  it('requires app gate only in app-gated mode', () => {
    const creds = {
      username: 'nodefox42',
      password: 'secret',
      loginRequired: true,
      loginMode: 'app-gated'
    }
    assert.equal(workstationLoginGateRequired(creds), true)
    assert.equal(workstationCredentialsVisible(creds), true)
    assert.equal(workstationTerminalUsesTtyLogin(creds), false)
  })

  it('uses tty login in tty-login mode', () => {
    const creds = {
      username: 'nodefox42',
      password: 'secret',
      loginRequired: true,
      loginMode: 'tty-login'
    }
    assert.equal(workstationLoginGateRequired(creds), false)
    assert.equal(workstationCredentialsVisible(creds), true)
    assert.equal(workstationTerminalUsesTtyLogin(creds), true)
  })

  it('hides credentials and skips login in auto-login mode', () => {
    const creds = {
      username: 'nodefox42',
      password: 'secret',
      loginRequired: false,
      loginMode: 'auto-login'
    }
    assert.equal(workstationCredentialsVisible(creds), false)
    assert.equal(workstationLoginGateRequired(creds), false)
    assert.equal(workstationTerminalUsesTtyLogin(creds), false)
  })
})

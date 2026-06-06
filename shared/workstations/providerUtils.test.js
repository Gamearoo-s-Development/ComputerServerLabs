/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isDesktopContainerProvider,
  isLinuxProvider,
  isTerminalWorkstationProvider,
  isWindowsProvider,
  requiresKvm,
  safeIsDesktopContainerProvider
} from './providerUtils.js'

describe('providerUtils', () => {
  it('isDesktopContainerProvider(desktop-container-windows) === true', () => {
    assert.equal(isDesktopContainerProvider('desktop-container-windows'), true)
  })

  it('isDesktopContainerProvider(ubuntu-terminal) === false', () => {
    assert.equal(isDesktopContainerProvider('ubuntu-terminal'), false)
  })

  it('classifies all desktop container providers', () => {
    for (const id of [
      'desktop-container-windows',
      'desktop-container-ubuntu',
      'desktop-container-debian',
      'desktop-container-kali'
    ]) {
      assert.equal(isDesktopContainerProvider(id), true)
      assert.equal(requiresKvm(id), true)
    }
  })

  it('classifies terminal providers', () => {
    assert.equal(isTerminalWorkstationProvider('ubuntu-terminal'), true)
    assert.equal(isTerminalWorkstationProvider('kali-terminal'), true)
    assert.equal(isTerminalWorkstationProvider('desktop-container-ubuntu'), false)
  })

  it('classifies windows vs linux providers', () => {
    assert.equal(isWindowsProvider('windows-terminal'), true)
    assert.equal(isWindowsProvider('ubuntu-terminal'), false)
    assert.equal(isLinuxProvider('ubuntu-terminal'), true)
    assert.equal(isLinuxProvider('desktop-container-windows'), false)
  })

  it('safeIsDesktopContainerProvider never throws on bad input', () => {
    assert.equal(safeIsDesktopContainerProvider(null), false)
    assert.equal(safeIsDesktopContainerProvider(undefined), false)
    assert.equal(safeIsDesktopContainerProvider(''), false)
    assert.equal(safeIsDesktopContainerProvider('desktop-container-kali'), true)
  })
})

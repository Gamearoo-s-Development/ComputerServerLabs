/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getHostOsLabel } from './workstationHostInfo.js'
import {
  buildDockerModeStatus,
  buildWindowsWorkstationCompatibility,
  buildWindowsModeMismatchReasons
} from './windowsContainerSupport.js'

describe('workstationHostInfo', () => {
  it('labels Windows 11 by build number', () => {
    const info = getHostOsLabel('win32', '10.0.26200')
    assert.equal(info.label, 'Windows 11')
  })

  it('labels Windows 10 for older builds', () => {
    const info = getHostOsLabel('win32', '10.0.19045')
    assert.equal(info.label, 'Windows 10')
  })
})

describe('windowsContainerSupport', () => {
  it('reports Linux containers active', () => {
    const mode = buildDockerModeStatus({
      dockerReady: true,
      dockerLinuxContainers: true,
      dockerServerOs: 'linux'
    })
    assert.equal(mode.modeLabel, 'Linux Containers Active')
  })

  it('explains Windows unavailable in Linux mode', () => {
    const compat = buildWindowsWorkstationCompatibility({
      hostOs: 'win32',
      isWindowsHost: true,
      dockerReady: true,
      dockerWindowsContainers: false,
      dockerServerOs: 'linux'
    })
    assert.equal(compat.available, false)
    assert.equal(compat.status, 'linux-mode-active')
    assert.ok(buildWindowsModeMismatchReasons().length >= 3)
  })
})

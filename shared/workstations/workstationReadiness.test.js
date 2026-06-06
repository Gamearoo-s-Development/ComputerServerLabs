/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyReadinessFromLogs,
  DESKTOP_READINESS_STATE,
  evaluateWindowsDesktopReady,
  formatReadinessStateLabel,
  formatDesktopSetupLogTail,
  isDesktopReadinessComplete,
  logsIndicateWindowsBooting,
  VIEWER_HTTP_STABLE_MS
} from './desktopReadinessLogic.js'

describe('workstationReadiness', () => {
  it('detects Windows download phase from logs', () => {
    const logs = '❯ Downloading Windows 11...\n❯ Downloading https://example.com/win.iso\n45%'
    assert.equal(classifyReadinessFromLogs(logs, true), DESKTOP_READINESS_STATE.DOWNLOADING_OS)
  })

  it('detects Windows ready marker from logs', () => {
    const logs = 'Boot complete\n❯ Ready!\nWindows started'
    const state = classifyReadinessFromLogs(logs, true)
    assert.equal(isDesktopReadinessComplete(state), true)
  })

  it('does not mark ready when still installing', () => {
    const logs = '❯ Installing Windows...\nPlease wait'
    const state = classifyReadinessFromLogs(logs, true)
    assert.equal(isDesktopReadinessComplete(state), false)
  })

  it('does not auto-ready Windows from HTTP viewer alone', () => {
    const result = evaluateWindowsDesktopReady({
      logText: 'Booting QEMU…\nBdsDxe: loading Boot0002',
      viewerHttp200: true,
      viewerPortMapped: true,
      viewerStableMs: VIEWER_HTTP_STABLE_MS
    })
    assert.equal(result.ready, false)
    assert.equal(result.installing, true)
  })

  it('shows installing OS while viewer is reachable during setup', () => {
    const result = evaluateWindowsDesktopReady({
      logText: '❯ Installing Windows...\nWeb viewer started',
      viewerHttp200: true,
      viewerPortMapped: true
    })
    assert.equal(result.ready, false)
    assert.equal(result.viewerAvailable, true)
    assert.equal(result.installing, true)
    assert.equal(result.state, DESKTOP_READINESS_STATE.INSTALLING_OS)
  })

  it('marks ready when dockur logs indicate OS is usable', () => {
    const result = evaluateWindowsDesktopReady({
      logText: 'RDP server listening\n❯ Ready!\nWindows started',
      viewerHttp200: true,
      viewerPortMapped: true
    })
    assert.equal(result.ready, true)
    assert.equal(result.viaLogs, true)
  })

  it('does not treat web viewer started as OS ready', () => {
    const result = evaluateWindowsDesktopReady({
      logText: 'Web viewer started',
      viewerHttp200: true,
      viewerPortMapped: true
    })
    assert.equal(result.ready, false)
    assert.equal(result.state, DESKTOP_READINESS_STATE.VIEWER_AVAILABLE)
  })

  it('blocks ready while active setup logs are present', () => {
    const result = evaluateWindowsDesktopReady({
      logText: '❯ Downloading Windows 11...\n45%',
      viewerHttp200: true,
      viewerPortMapped: true
    })
    assert.equal(result.ready, false)
    assert.equal(result.installing, true)
  })

  it('formats readiness state labels for UI', () => {
    assert.equal(formatReadinessStateLabel(DESKTOP_READINESS_STATE.VIEWER_AVAILABLE), 'Viewer available')
    assert.equal(formatReadinessStateLabel(DESKTOP_READINESS_STATE.INSTALLING_OS), 'Installing OS')
    assert.equal(formatReadinessStateLabel(DESKTOP_READINESS_STATE.DESKTOP_READY), 'Ready')
  })

  it('formats setup log tail for preview UI', () => {
    const raw = '\x1b[32m❯ Downloading Windows\x1b[0m\n\n45% complete\n[1;34mRequesting Windows 11'
    assert.deepEqual(formatDesktopSetupLogTail(raw, 2), ['45% complete', 'Requesting Windows 11'])
  })

  it('does not treat dockur container started as Windows ready', () => {
    const logs = ['❯ Installing Windows...', 'Please wait', '❯ started.'].join('\n')
    assert.equal(isDesktopReadinessComplete(classifyReadinessFromLogs(logs, true)), false)
  })

  it('blocks ready during UEFI boot when hard disk is missing', () => {
    const logs =
      'BdsDxe: failed to load Boot0002 "UEFI QEMU HARDDISK" from PciRoot(0x0)/Pci(0xA,0x0)/Scsi(0x0,0x0): Not Found'
    const result = evaluateWindowsDesktopReady({
      logText: logs,
      logState: DESKTOP_READINESS_STATE.BOOTING,
      viewerHttp200: true,
      viewerPortMapped: true
    })
    assert.equal(result.ready, false)
    assert.equal(result.state, DESKTOP_READINESS_STATE.BOOTING)
  })

  it('does not auto-ready Windows from stable HTTP viewer alone', () => {
    const logs = [
      '❯ Installing Windows...',
      'Please wait',
      ...Array(15).fill('setup heartbeat'),
      'listening on port 8006'
    ].join('\n')
    const result = evaluateWindowsDesktopReady({
      logText: logs,
      logState: DESKTOP_READINESS_STATE.VIEWER_AVAILABLE,
      viewerHttp200: true,
      viewerPortMapped: true
    })
    assert.equal(result.ready, false)
    assert.equal(result.state, DESKTOP_READINESS_STATE.VIEWER_AVAILABLE)
  })

  it('detects Windows boot phase from UEFI logs', () => {
    const logs = 'BdsDxe: starting Boot0001 "UEFI QEMU DVD-ROM QM00013"'
    assert.equal(logsIndicateWindowsBooting(logs), true)
    assert.equal(isDesktopReadinessComplete(classifyReadinessFromLogs(logs, true)), false)
  })

  it('does not auto-ready Windows while recent logs still show active setup', () => {
    const result = evaluateWindowsDesktopReady({
      logText: '❯ Installing Windows...\n45%',
      viewerHttp200: true,
      viewerPortMapped: true
    })
    assert.equal(result.ready, false)
    assert.equal(result.installing, true)
  })
})

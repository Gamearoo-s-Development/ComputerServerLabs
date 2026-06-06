/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import { getConfigPath } from '../utils/paths.js'

export const PORT_PURPOSE_BY_CONTAINER = {
  8006: 'desktop-web',
  3000: 'desktop-web',
  3001: 'desktop-vnc',
  3389: 'desktop-rdp',
  5900: 'desktop-vnc'
}

/** @type {object | null} */
let cachedRaw = null

export function clearDesktopFileDefaultsCache() {
  cachedRaw = null
}

export function loadRawDesktopFileDefaults() {
  if (cachedRaw) return cachedRaw
  const fallback = {
    allowWithoutKvm: false,
    resourceWarning:
      'Desktop workstations are heavier than terminal containers and may require several GB of RAM and disk.',
    kaliResourceWarning: 'Kali images are larger and intended for advanced labs.',
    desktopWorkstations: {}
  }
  try {
    cachedRaw = JSON.parse(fs.readFileSync(getConfigPath('workstation.desktop.json'), 'utf8'))
  } catch {
    cachedRaw = fallback
  }
  return cachedRaw
}

/**
 * @param {number[]} accessPorts
 * @param {number} webViewerPort
 */
export function buildDesktopContainerPortSpecs(accessPorts, webViewerPort) {
  const ports = accessPorts?.length ? accessPorts : [webViewerPort, 5900]
  return ports.map((container) => ({
    container,
    protocol: 'tcp',
    purpose: PORT_PURPOSE_BY_CONTAINER[container] ?? `desktop-${container}`
  }))
}

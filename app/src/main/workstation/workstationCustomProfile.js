/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { getLabsPath } from '../utils/paths.js'
import { normalizeProfileId } from './workstationCatalog.js'

/**
 * @param {object} [lab]
 */
export function isCustomWorkstationEnabled(lab) {
  return lab?.workstation?.custom?.enabled === true
}

/**
 * @param {object} lab
 * @param {string} [labRootPath]
 */
export function resolveCustomWorkstationImageTag(lab, labRootPath) {
  const labId = lab?.id ?? 'lab'
  return `sysadmin-game/workstation-${labId}:latest`
}

/**
 * @param {object} lab
 * @param {string} [labRootPath]
 */
export function resolveCustomWorkstationRoot(lab, labRootPath) {
  if (labRootPath && fs.existsSync(path.join(labRootPath, 'workstation'))) {
    return path.join(labRootPath, 'workstation')
  }
  const catalogRoot = path.join(getLabsPath(), lab?.id ?? '')
  if (fs.existsSync(path.join(catalogRoot, 'workstation'))) {
    return path.join(catalogRoot, 'workstation')
  }
  if (labRootPath) return path.join(labRootPath, 'workstation')
  return path.join(catalogRoot, 'workstation')
}

/**
 * @param {object} lab
 */
export function resolveCustomWorkstationProfile(lab) {
  const custom = lab?.workstation?.custom
  if (!custom?.enabled) return null

  const labId = lab.id
  const runtime = custom.runtime === 'windows' ? 'windows' : 'linux'
  const isWindows = runtime === 'windows'
  const image = resolveCustomWorkstationImageTag(lab)

  return {
    id: 'custom',
    name: custom.name ?? 'Custom Lab Workstation',
    kind: isWindows ? 'windows-terminal' : 'linux-terminal',
    provider: isWindows ? 'docker-windows-terminal' : 'docker-linux-terminal',
    type: isWindows ? 'windows' : 'linux',
    image,
    buildPath: 'workstation',
    platform: isWindows ? 'windows/amd64' : undefined,
    defaultShell: isWindows ? 'powershell' : 'bash',
    terminalShell: isWindows ? 'powershell.exe' : '/bin/bash',
    accessModes: ['terminal'],
    capabilities: isWindows
      ? ['windows', 'terminal', 'docker', 'ssh', 'powershell']
      : ['linux', 'terminal', 'docker', 'ssh'],
    tools: isWindows ? ['powershell', 'openssh'] : ['ssh', 'curl', 'nano', 'vim'],
    custom: true,
    customSourceType: custom.sourceType ?? 'generated',
    description:
      custom.description ??
      'Lab-specific workstation image with investigation tools and files (not placed on the lab target).',
    notSandboxed: false,
    advancedOnly: false
  }
}

/**
 * @param {object} profile
 * @param {string} labsRoot
 * @param {{ labRootPath?: string, lab?: object }} [options]
 */
export function resolveWorkstationBuildContextForProfile(profile, labsRoot, options = {}) {
  if (profile?.custom === true || profile?.id === 'custom') {
    const lab = options.lab
    const wsRoot = resolveCustomWorkstationRoot(lab ?? {}, options.labRootPath)
    return {
      buildContext: wsRoot,
      dockerfilePath: path.join(wsRoot, 'Dockerfile')
    }
  }
  const buildPathRel = profile.buildPath ?? '_shared/workstations/ubuntu-workstation'
  const profileDir = path.resolve(labsRoot, buildPathRel)
  const buildContext = path.resolve(labsRoot, '_shared/workstations')
  return {
    buildContext,
    dockerfilePath: path.join(profileDir, 'Dockerfile')
  }
}

/**
 * @param {string} profileId
 * @param {object} [lab]
 */
export function resolveProfileWithLab(profileId, lab) {
  const id = normalizeProfileId(profileId) ?? profileId
  if (id === 'custom' && lab) {
    return resolveCustomWorkstationProfile(lab)
  }
  return null
}

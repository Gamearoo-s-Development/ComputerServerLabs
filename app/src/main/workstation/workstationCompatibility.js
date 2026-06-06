/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { normalizeLabWorkstationMetadata, normalizeProfileId } from './workstationCatalog.js'

/** @type {Record<string, string>} */
const CAPABILITY_LABELS = {
  linux: 'Linux environment',
  windows: 'Windows environment',
  terminal: 'terminal / shell access',
  shell: 'shell access',
  desktop: 'desktop GUI',
  docker: 'Docker container workstation',
  ssh: 'SSH client tools',
  'ssh-client': 'SSH client tools',
  powershell: 'PowerShell',
  browser: 'web browser',
  'browser-or-host-access': 'browser or host port access',
  'linux-only': 'Linux-only workstation',
  'docker-terminal-only': 'integrated Docker terminal workstation',
  'no-desktop': 'no desktop GUI',
  'security-tools': 'security tooling (Kali-style desktop)',
  'ssh-client': 'SSH client inside the workstation'
}

/**
 * @param {Set<string>} profileCaps
 * @param {string} requiredCap
 * @param {object} [profile]
 */
function profileSatisfiesCapability(profileCaps, requiredCap, profile) {
  if (requiredCap === 'linux-only') {
    return profileCaps.has('linux') && !profileCaps.has('desktop')
  }
  if (requiredCap === 'docker-terminal-only') {
    return (
      profile?.provider === 'docker-linux-terminal' || profile?.provider === 'docker-windows-terminal'
    )
  }

  if (profileCaps.has(requiredCap)) return true
  if (requiredCap === 'ssh-client' && profileCaps.has('ssh')) return true
  if (requiredCap === 'ssh' && profileCaps.has('ssh')) return true
  if (requiredCap === 'powershell' && (profileCaps.has('powershell') || profileCaps.has('windows'))) return true
  if (requiredCap === 'browser-or-host-access' && (profileCaps.has('browser') || profileCaps.has('terminal'))) {
    return true
  }
  if (requiredCap === 'terminal') {
    if (profileCaps.has('shell')) return true
    if (profileCaps.has('powershell')) return true
    if (profileCaps.has('desktop') && profileCaps.has('windows')) return true
    if (profileCaps.has('desktop') && profileCaps.has('ssh-client')) return true
  }
  if (requiredCap === 'security-tools') {
    return profileCaps.has('security-tools')
  }
  if (requiredCap === 'shell' && (profileCaps.has('terminal') || profileCaps.has('powershell'))) return true
  return false
}

/**
 * @param {object} [lab]
 */
export function labNeedsTerminalAccess(lab) {
  const ports = lab?.docker?.ports ?? []
  return ports.some((p) => {
    const container = p.container ?? p.containerPort
    return p.purpose === 'ssh' || container === 22 || container === '22'
  })
}

/**
 * @param {object} profile
 * @returns {Set<string>}
 */
export function getProfileCapabilities(profile) {
  const caps = new Set()
  if (!profile) return caps

  if (Array.isArray(profile.capabilities) && profile.capabilities.length > 0) {
    for (const cap of profile.capabilities) {
      if (typeof cap === 'string' && cap.trim()) caps.add(cap.trim().toLowerCase())
    }
    return caps
  }

  if (profile.type === 'linux') caps.add('linux')
  if (profile.type === 'windows') {
    caps.add('windows')
    caps.add('powershell')
  }

  for (const mode of profile.accessModes ?? ['terminal']) {
    if (mode === 'terminal') caps.add('terminal')
    if (mode === 'desktop') caps.add('desktop')
  }

  caps.add('docker')

  const tools = (profile.tools ?? []).map((t) => String(t).toLowerCase())
  if (tools.some((t) => t === 'ssh' || t === 'openssh' || t === 'scp')) {
    caps.add('ssh')
  }

  if (caps.has('terminal')) {
    if (profile.type === 'linux' || profile.type === 'windows') {
      caps.add('ssh')
    }
  }

  return caps
}

/**
 * @param {string[]} caps
 */
function formatMissingCapabilities(caps) {
  const parts = caps.map((c) => CAPABILITY_LABELS[c] ?? c)
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

/**
 * @param {object} [labWorkstation]
 * @param {object} [lab]
 */
export function normalizeLabWorkstationRequirements(labWorkstation, lab) {
  const meta = normalizeLabWorkstationMetadata(labWorkstation)

  /** @type {string[]} */
  let requiredCapabilities = []
  if (Array.isArray(labWorkstation?.requiredCapabilities)) {
    requiredCapabilities = labWorkstation.requiredCapabilities
      .map((c) => String(c).trim().toLowerCase())
      .filter(Boolean)
  }

  /** @type {string[]} */
  let preferredCapabilities = []
  const preferredRaw =
    labWorkstation?.preferredCapabilities ??
    labWorkstation?.optionalCapabilities ??
    labWorkstation?.preferred ??
    null
  if (Array.isArray(preferredRaw)) {
    preferredCapabilities = preferredRaw.map((c) => String(c).trim().toLowerCase()).filter(Boolean)
  }

  /** @type {string[]} */
  let blockedCapabilities = []
  if (Array.isArray(labWorkstation?.blockedCapabilities)) {
    blockedCapabilities = labWorkstation.blockedCapabilities
      .map((c) => String(c).trim().toLowerCase())
      .filter(Boolean)
  }

  if (requiredCapabilities.length === 0 && labNeedsTerminalAccess(lab)) {
    requiredCapabilities = ['terminal']
  }

  const restrictToSupported =
    labWorkstation?.restrictToSupported === true || labWorkstation?.supportedOnly === true

  const allowLocalTerminal = labWorkstation?.allowLocalTerminal === true
  const allowWslLocalTerminal = labWorkstation?.allowWslLocalTerminal === true
  const preferDockerWorkstation = labWorkstation?.preferDockerWorkstation !== false
  const vmTemplateRequired = labWorkstation?.vmTemplateRequired === true

  return {
    ...meta,
    requiredCapabilities,
    preferredCapabilities,
    blockedCapabilities,
    restrictToSupported,
    allowLocalTerminal,
    allowWslLocalTerminal,
    preferDockerWorkstation,
    vmTemplateRequired
  }
}

/**
 * @param {string[]} supportedIds
 * @param {string} profileId
 */
function legacySupportedListIncludes(supportedIds, profileId) {
  if (!supportedIds.length) return true
  const normalized = normalizeProfileId(profileId)
  return supportedIds.some((id) => normalizeProfileId(id) === normalized)
}

/**
 * @param {object} profile
 * @param {ReturnType<typeof normalizeLabWorkstationRequirements>} labReq
 * @param {object} [lab]
 */
export function evaluateProfileLabCompatibility(profile, labReq, lab) {
  if (!profile) {
    return {
      compatible: false,
      message: 'Unknown workstation profile.',
      missingRequired: [],
      blocked: [],
      preferredMiss: []
    }
  }

  const profileId = normalizeProfileId(profile.id) ?? profile.id
  const profileCaps = getProfileCapabilities(profile)

  if (profileId === 'custom' && lab && lab.workstation?.custom?.enabled !== true) {
    return {
      compatible: false,
      message: 'Custom workstation is not enabled for this lab.',
      missingRequired: ['custom-disabled'],
      blocked: [],
      preferredMiss: []
    }
  }

  if (labReq.requiredProfile && normalizeProfileId(labReq.requiredProfile) !== profileId) {
    const requiredProfile = normalizeProfileId(labReq.requiredProfile)
    const requiredLabel =
      requiredProfile === 'custom'
        ? lab?.workstation?.custom?.name ?? 'Custom Lab Workstation'
        : (requiredProfile ?? labReq.requiredProfile)
    return {
      compatible: false,
      message: `This lab requires the ${requiredLabel} workstation.`,
      missingRequired: ['required-profile'],
      blocked: [],
      preferredMiss: []
    }
  }

  if (profileId === 'local-terminal' || profile.provider === 'host-local-terminal') {
    if (!labReq.allowLocalTerminal) {
      return {
        compatible: false,
        message: 'This lab does not allow Local Terminal Workstation.',
        missingRequired: ['local-terminal-disabled'],
        blocked: [],
        preferredMiss: []
      }
    }
    if (lab?.difficulty === 'Easy' && labReq.preferDockerWorkstation !== false) {
      return {
        compatible: false,
        message: 'Beginner labs use sandboxed Docker workstations only.',
        missingRequired: [],
        blocked: ['local-terminal'],
        preferredMiss: []
      }
    }
  }

  if (profileId === 'wsl-local-terminal' || profile.provider === 'host-wsl-terminal') {
    if (!labReq.allowWslLocalTerminal) {
      return {
        compatible: false,
        message: 'This lab does not allow WSL Local Linux Terminal.',
        missingRequired: ['wsl-local-terminal-disabled'],
        blocked: [],
        preferredMiss: []
      }
    }
    if (lab?.difficulty === 'Easy' && labReq.preferDockerWorkstation !== false) {
      return {
        compatible: false,
        message: 'Beginner labs use sandboxed Docker container workstations only.',
        missingRequired: [],
        blocked: ['wsl-local-terminal'],
        preferredMiss: []
      }
    }
  }

  if (labReq.restrictToSupported && labReq.supported.length > 0) {
    if (!legacySupportedListIncludes(labReq.supported, profileId)) {
      return {
        compatible: false,
        message: `This workstation is not in this lab's allowed list (${labReq.supported.join(', ')}).`,
        missingRequired: ['allowed-list'],
        blocked: [],
        preferredMiss: []
      }
    }
  }

  /** @type {string[]} */
  const missingRequired = []
  for (const cap of labReq.requiredCapabilities ?? []) {
    if (!profileSatisfiesCapability(profileCaps, cap, profile)) missingRequired.push(cap)
  }

  /** @type {string[]} */
  const blocked = []
  for (const cap of labReq.blockedCapabilities ?? []) {
    if (cap === 'no-desktop' && profileCaps.has('desktop')) {
      blocked.push(cap)
    } else if (profileCaps.has(cap)) {
      blocked.push(cap)
    }
  }

  if (missingRequired.length > 0) {
    return {
      compatible: false,
      message: `This workstation does not meet the lab requirements. Missing: ${formatMissingCapabilities(missingRequired)}.`,
      missingRequired,
      blocked,
      preferredMiss: []
    }
  }

  if (blocked.length > 0) {
    return {
      compatible: false,
      message: `This workstation is not allowed for this lab (${formatMissingCapabilities(blocked)} not permitted).`,
      missingRequired: [],
      blocked,
      preferredMiss: []
    }
  }

  /** @type {string[]} */
  const preferredMiss = []
  for (const cap of labReq.preferredCapabilities ?? []) {
    if (!profileSatisfiesCapability(profileCaps, cap, profile)) preferredMiss.push(cap)
  }

  const labRequiresTerminal =
    (labReq.requiredCapabilities ?? []).includes('terminal') ||
    ((labReq.requiredCapabilities ?? []).length === 0 && labNeedsTerminalAccess(lab))

  let message = null
  if (preferredMiss.length > 0) {
    message = `Works, but this lab prefers ${formatMissingCapabilities(preferredMiss)}.`
  } else if (
    (profile.provider?.startsWith('desktop-container-') ?? false) &&
    labRequiresTerminal
  ) {
    message = 'Works. You can use PowerShell inside the desktop.'
  }

  return {
    compatible: true,
    message,
    missingRequired: [],
    blocked: [],
    preferredMiss,
    profileCapabilities: [...profileCaps]
  }
}

/**
 * @param {object} profile
 * @param {{ workstation?: object }} [lab]
 */
export function profileMeetsLabRequirements(profile, lab) {
  const labReq = normalizeLabWorkstationRequirements(lab?.workstation, lab)
  return evaluateProfileLabCompatibility(profile, labReq, lab).compatible
}

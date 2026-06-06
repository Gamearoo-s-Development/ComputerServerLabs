/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { classifyDockerImageTrust } from './dockerImageTrust.js'
import { isCustomWorkstationEnabled } from './workstation/workstationCustomProfile.js'
import { normalizeTargetUser, scanFilesystemPaths } from './labBuilder/labFilesystem.js'

/** Root wipe only — allow normal image cleanup like `rm -rf /var/lib/apt/lists/*`. */
const HOST_RISK_PATTERN =
  /\b(?:rm\s+-rf\s+\/(?=[\s*]|$)|format\s|c:\\\\Windows|bcdedit|diskpart|\bdd\b\s+if=|mkfs\.|shutdown\s+-|reboot\s|\/var\/disk|iptables\s+-F|ufw\s+disable|netsh\s+advfirewall|curl\s+\S+\s*\|\s*bash|wget\s+\S+\s*\|\s*sh)\b/i

const HIGH_RESOURCE =
  /--memory=(?:(?:\d+[gGmM])|[5-9]\d{3,}m)|--cpus=(?:(?:[3-9]|\d{2,})\.?\d*)|cpus:\s*(?:[3-9]|\d{2,})|memory:\s*[3-9]\d{4,}/

/**
 * @param {object | null} lab
 * @param {{ dockerfile?: string, entrypoint?: string, workstationDockerfile?: string, validateSh?: string, readme?: string }} files
 */
export function analyzeLabDraftSafety(lab, files = {}) {
  /** @type {{ severity: 'info'|'warning'|'blocked', code: string, message: string }[]} */
  const issues = []

  const scan = `${files.dockerfile ?? ''}\n${files.entrypoint ?? ''}\n${files.workstationDockerfile ?? ''}\n${files.validateSh ?? ''}`
  const labJsonScan = JSON.stringify(lab ?? {})

  if (lab?.docker?.privileged === true || /--privileged\b/i.test(scan)) {
    issues.push({ severity: 'blocked', code: 'privileged', message: 'Privileged containers are blocked for safety.' })
  }
  if (/--network[= ]host\b|--net=host\b/i.test(scan)) {
    issues.push({ severity: 'blocked', code: 'host_network', message: 'Host network mode is blocked.' })
  }
  if (/--cap-add[= ]SYS_ADMIN\b|--cap-add=ALL\b/i.test(scan)) {
    issues.push({ severity: 'blocked', code: 'dangerous_cap', message: 'Dangerous capabilities (SYS_ADMIN) are blocked.' })
  }
  if (/--device[= ]|\/dev\/[a-z]/i.test(scan)) {
    issues.push({ severity: 'blocked', code: 'device_mount', message: 'Device mounts are blocked for lab targets.' })
  }
  if (/[ \t]-v\s+\/+|--volume[= ]\s*[/\\.]:|^VOLUME\s+[/\\]/im.test(scan) || /--mount=.*(?:bind|host)/i.test(scan)) {
    issues.push({
      severity: 'blocked',
      code: 'host_mount',
      message: 'Host bind mounts detected — not allowed under default Safety Mode.'
    })
  }
  if (/\/var\/run\/docker\.sock|docker\.sock/i.test(scan) || /docker\.sock/i.test(labJsonScan)) {
    issues.push({
      severity: 'blocked',
      code: 'docker_socket',
      message: 'Docker socket mount/reference is blocked — never expose the daemon to labs.'
    })
  }
  if (lab?.credentials?.password) {
    issues.push({ severity: 'blocked', code: 'hardcoded_password', message: 'Hardcoded credentials.password must not appear in labs.' })
  }
  const passwordLiteral = /\bPASSWORD\s*[:=]\s*['"]?[a-zA-Z0-9]{4,}/i.test(labJsonScan)
  if (passwordLiteral) {
    issues.push({ severity: 'warning', code: 'credential_literal', message: 'Avoid credential-looking literals inside lab JSON.' })
  }
  if (HOST_RISK_PATTERN.test(scan) || HOST_RISK_PATTERN.test(files.readme ?? '')) {
    issues.push({
      severity: 'blocked',
      code: 'host_destructive',
      message: 'Suspicious destructive or host-targeting patterns detected.'
    })
  }
  for (const cmd of lab?.docker?.startupCommands ?? []) {
    if (HOST_RISK_PATTERN.test(cmd.command ?? '')) {
      issues.push({
        severity: 'blocked',
        code: 'startup_dangerous',
        message: `Startup command blocked: ${cmd.label ?? 'command'}`
      })
    } else if (cmd.command) {
      issues.push({
        severity: 'info',
        code: 'startup_command',
        message: `Startup command will run as ${cmd.runAs ?? 'root'}: ${cmd.label ?? cmd.command.slice(0, 60)}`
      })
    }
  }
  if (HIGH_RESOURCE.test(scan)) {
    issues.push({
      severity: 'warning',
      code: 'high_resource',
      message: 'Large CPU/memory hints detected — learners may overwhelm low-end hosts.'
    })
  }
  if (/curl[^\n]*\|\s*bash|wget[^\n]*\|\s*sh/i.test(scan)) {
    issues.push({
      severity: 'warning',
      code: 'curl_pipe',
      message: 'curl|bash patterns are discouraged in lab images.'
    })
  }

  const trust = classifyDockerImageTrust(lab?.docker?.image ?? '', {
    localBuild: lab?.docker?.builderGenerated === true || lab?.docker?.imageSource === 'local-build'
  })
  if (trust.badge === 'local-build') {
    issues.push({
      severity: 'warning',
      code: 'local_build',
      message: 'Local Build Image — review generated Dockerfile before publishing.'
    })
  }

  if (isCustomWorkstationEnabled(lab)) {
    issues.push({
      severity: 'warning',
      code: 'custom_workstation_build',
      message:
        'Custom Local Build Image — this workstation image is built from the lab pack. Review generated Dockerfile and files before running.'
    })
  }

  if (trust.badge === 'unverified' || trust.badge === 'community') {
    issues.push({
      severity: 'warning',
      code: 'unofficial_image',
      message: `Image trust: ${trust.badgeLabel} (${trust.publisher})`
    })
  }

  const exposed = (lab?.docker?.ports ?? []).filter((p) => p.exposeToHost === true)
  if (exposed.length > 4) {
    issues.push({
      severity: 'warning',
      code: 'many_ports',
      message: `${exposed.length} ports publish to localhost — verify each is required.`
    })
  }

  const targetUser = normalizeTargetUser(lab)
  if (targetUser.mode === 'root' && targetUser.allowRoot) {
    issues.push({
      severity: 'warning',
      code: 'root_login_lab',
      message:
        'Root access is allowed inside the lab target only. Use only for labs where root/admin repair is the intended skill.'
    })
  }

  for (const fsIssue of scanFilesystemPaths(lab, { developerMode: false })) {
    issues.push({
      severity: fsIssue.severity === 'blocked' ? 'blocked' : 'warning',
      code: 'filesystem_path',
      message: fsIssue.message
    })
  }

  if (lab?.workstation?.custom?.sudoPasswordless === true) {
    issues.push({
      severity: 'warning',
      code: 'ws_sudo',
      message: 'Workstation passwordless sudo is enabled — use only when the lab explicitly requires it.'
    })
  }

  const allowedValidation = new Set([
    'command',
    'fileExists',
    'serviceRunning',
    'httpResponse',
    'portOpen',
    'userExists',
    'permission',
    'packageInstalled',
    'textAnswer'
  ])
  const vType = lab?.validation?.type
  if (vType && !allowedValidation.has(vType)) {
    issues.push({ severity: 'blocked', code: 'unknown_validation', message: `Unknown validation type ${vType}` })
  }

  if (lab?.runtime === 'docker' && !lab.docker) {
    issues.push({ severity: 'blocked', code: 'docker_required', message: 'Docker runtime requires docker block.' })
  }

  return {
    issues,
    hasBlocked: issues.some((i) => i.severity === 'blocked')
  }
}

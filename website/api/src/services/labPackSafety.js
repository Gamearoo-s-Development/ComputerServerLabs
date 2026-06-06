/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** Root wipe only — allow image cleanup like `rm -rf /var/lib/apt/lists/*`. */
const HOST_RISK_PATTERN =
  /\b(?:rm\s+-rf\s+\/(?=[\s*]|$)|format\s|c:\\\\Windows|bcdedit|diskpart|\bdd\b\s+if=|mkfs\.|shutdown\s+-|reboot\s|\/var\/disk|iptables\s+-F|ufw\s+disable|netsh\s+advfirewall|curl\s+\S+\s*\|\s*bash|wget\s+\S+\s*\|\s*sh)\b/i

/**
 * Server-side safety scan for uploaded lab packs (mirrors desktop labBuilderSafety essentials).
 * @param {object | null} lab
 * @param {{ dockerfile?: string, entrypoint?: string, workstationDockerfile?: string, validateSh?: string }} files
 */
export function analyzeLabPackSafety(lab, files = {}) {
  /** @type {{ severity: 'info'|'warning'|'blocked', code: string, message: string }[]} */
  const issues = []
  const scan = `${files.dockerfile ?? ''}\n${files.entrypoint ?? ''}\n${files.workstationDockerfile ?? ''}\n${files.validateSh ?? ''}`
  const labJsonScan = JSON.stringify(lab ?? {})

  if (lab?.docker?.privileged === true || /--privileged\b/i.test(scan)) {
    issues.push({ severity: 'blocked', code: 'privileged', message: 'Privileged containers are blocked.' })
  }
  if (/--network[= ]host\b|--net=host\b/i.test(scan)) {
    issues.push({ severity: 'blocked', code: 'host_network', message: 'Host network mode is blocked.' })
  }
  if (/--cap-add[= ]SYS_ADMIN\b|--cap-add=ALL\b/i.test(scan)) {
    issues.push({ severity: 'blocked', code: 'dangerous_cap', message: 'Dangerous capabilities are blocked.' })
  }
  if (/\/var\/run\/docker\.sock|docker\.sock/i.test(scan) || /docker\.sock/i.test(labJsonScan)) {
    issues.push({ severity: 'blocked', code: 'docker_socket', message: 'Docker socket references are blocked.' })
  }
  if (/[ \t]-v\s+\/+|--volume[= ]\s*[/\\.]:|^VOLUME\s+[/\\]/im.test(scan) || /--mount=.*(?:bind|host)/i.test(scan)) {
    issues.push({ severity: 'blocked', code: 'host_mount', message: 'Host bind mounts are blocked.' })
  }
  if (lab?.credentials?.password) {
    issues.push({ severity: 'blocked', code: 'hardcoded_password', message: 'Hardcoded credentials.password is not allowed.' })
  }
  if (HOST_RISK_PATTERN.test(scan)) {
    issues.push({ severity: 'blocked', code: 'host_destructive', message: 'Destructive host-targeting patterns detected.' })
  }
  if (!lab?.id || typeof lab.id !== 'string') {
    issues.push({ severity: 'blocked', code: 'missing_id', message: 'lab.json must include a string id.' })
  }
  if (!lab?.title) {
    issues.push({ severity: 'blocked', code: 'missing_title', message: 'lab.json must include a title.' })
  }

  return {
    issues,
    hasBlocked: issues.some((i) => i.severity === 'blocked'),
    hasWarnings: issues.some((i) => i.severity === 'warning')
  }
}

/** @param {string | undefined} raw */
export function normalizeRegistryCategory(raw) {
  const v = String(raw ?? 'general').toLowerCase()
  if (v.includes('linux') || v.includes('permission') || v.includes('systemd')) return 'linux'
  if (v.includes('network')) return 'networking'
  if (v.includes('storage') || v.includes('disk') || v.includes('database')) return 'storage'
  if (v.includes('security')) return 'security'
  if (v.includes('docker') || v.includes('container')) return 'containers'
  if (v.includes('web') || v.includes('nginx') || v.includes('service')) return 'web'
  if (v.includes('troubleshoot')) return 'general'
  if (v.includes('windows')) return 'general'
  return v.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 32) || 'general'
}

/** @param {string | undefined} raw */
export function normalizeRegistryDifficulty(raw) {
  const v = String(raw ?? 'beginner').toLowerCase()
  if (v === 'easy' || v === 'beginner') return 'beginner'
  if (v === 'medium' || v === 'intermediate') return 'intermediate'
  if (v === 'hard' || v === 'advanced') return 'advanced'
  return 'beginner'
}

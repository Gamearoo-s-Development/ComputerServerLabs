/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @typedef {'user_creation_failed' | 'password_setup_failed' | 'sshd_config_failed' | 'sshd_start_failed' | 'ssh_connection_reset' | 'ssh_route_failed' | 'ssh_login_failed' | 'unknown'} CredentialSetupStage */

export const CREDENTIAL_SETUP_STAGES = {
  USER_CREATION_FAILED: 'user_creation_failed',
  PASSWORD_SETUP_FAILED: 'password_setup_failed',
  SSHD_CONFIG_FAILED: 'sshd_config_failed',
  SSHD_START_FAILED: 'sshd_start_failed',
  SSH_CONNECTION_RESET: 'ssh_connection_reset',
  SSH_ROUTE_FAILED: 'ssh_route_failed',
  SSH_LOGIN_FAILED: 'ssh_login_failed',
  UNKNOWN: 'unknown'
}

/**
 * @param {string} combined
 */
export function extractSshdConfigErrorDetail(combined) {
  const text = String(combined ?? '')
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (/Subsystem.*already defined/i.test(line)) {
      const match = line.match(/Subsystem\s+'?sftp'?\s+already defined\.?/i)
      return match?.[0] ?? line
    }
    if (/sshd_config.*line\s+\d+/i.test(line)) {
      const match = line.match(/:\s*(.+)$/)
      return match?.[1]?.trim() || line
    }
  }

  const sshdBlock = lines.find((line) => /configure_mission_sshd: sshd -t failed/i.test(line))
  if (sshdBlock) {
    const idx = lines.indexOf(sshdBlock)
    const next = lines[idx + 1]
    if (next) return next
  }

  return lines.find((line) => /sshd_config|sshd -t|Subsystem/i.test(line)) ?? 'sshd -t validation failed'
}

/**
 * @param {string} combined
 */
function classifyApplyOutput(combined) {
  const text = String(combined ?? '')
  if (/chpasswd failed/i.test(text)) {
    return CREDENTIAL_SETUP_STAGES.PASSWORD_SETUP_FAILED
  }
  if (/useradd failed|could not create user|post-create id check failed/i.test(text)) {
    return CREDENTIAL_SETUP_STAGES.USER_CREATION_FAILED
  }
  if (/configure_mission_sshd|sshd -t failed|sshd_config|Subsystem/i.test(text)) {
    return CREDENTIAL_SETUP_STAGES.SSHD_CONFIG_FAILED
  }
  if (/chroot\(.*sshd|UsePrivilegeSeparation|Connection reset|preauth/i.test(text)) {
    return CREDENTIAL_SETUP_STAGES.SSH_CONNECTION_RESET
  }
  return CREDENTIAL_SETUP_STAGES.UNKNOWN
}

/**
 * @param {CredentialSetupStage} stage
 * @param {string} [detail]
 */
export function credentialSetupUserMessage(stage, detail) {
  switch (stage) {
    case CREDENTIAL_SETUP_STAGES.USER_CREATION_FAILED:
      return 'User creation failed inside the lab target.'
    case CREDENTIAL_SETUP_STAGES.PASSWORD_SETUP_FAILED:
      return 'Password setup failed for the generated lab user.'
    case CREDENTIAL_SETUP_STAGES.SSHD_CONFIG_FAILED:
      return `SSH configuration failed: ${detail || 'sshd -t validation failed'}`
    case CREDENTIAL_SETUP_STAGES.SSHD_START_FAILED:
      return 'SSH service is not listening inside the lab target.'
    case CREDENTIAL_SETUP_STAGES.SSH_CONNECTION_RESET:
      return 'SSH service accepted the connection but closed it during login setup. Check sshd_config, /run/sshd permissions, and that the lab target container has CAP_SYS_CHROOT and CAP_AUDIT_WRITE.'
    case CREDENTIAL_SETUP_STAGES.SSH_ROUTE_FAILED:
      return detail
        ? `SSH port is not reachable from the selected workstation: ${detail}`
        : 'SSH port is not reachable from the selected workstation.'
    case CREDENTIAL_SETUP_STAGES.SSH_LOGIN_FAILED:
      return detail ?? 'SSH connectivity check failed.'
    default:
      return detail || 'Lab credential setup failed inside the target container.'
  }
}

export class CredentialSetupError extends Error {
  /**
   * @param {string} message
   * @param {{ stage?: CredentialSetupStage, detail?: string, report?: string, applyResult?: object, live?: object, userExists?: boolean, targetContainerId?: string }} diagnostics
   */
  constructor(message, diagnostics = {}) {
    super(message)
    this.name = 'CredentialSetupError'
    this.stage = diagnostics.stage ?? CREDENTIAL_SETUP_STAGES.UNKNOWN
    this.detail = diagnostics.detail ?? null
    this.diagnostics = diagnostics
  }
}

/**
 * @param {{ stdout?: string, stderr?: string, userExists?: boolean }} params
 */
export function classifyCredentialApplyFailure(params) {
  const combined = `${params.stdout ?? ''}\n${params.stderr ?? ''}`
  let stage = classifyApplyOutput(combined)

  if (stage === CREDENTIAL_SETUP_STAGES.UNKNOWN && params.userExists) {
    stage = CREDENTIAL_SETUP_STAGES.SSHD_CONFIG_FAILED
  }

  const detail =
    stage === CREDENTIAL_SETUP_STAGES.SSHD_CONFIG_FAILED
      ? extractSshdConfigErrorDetail(combined)
      : combined.split('\n').find((line) => line.trim())?.trim() ?? null

  return {
    stage,
    detail,
    message: credentialSetupUserMessage(stage, detail ?? undefined)
  }
}

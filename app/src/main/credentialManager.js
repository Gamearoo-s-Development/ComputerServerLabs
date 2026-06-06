/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { ensureDataDirectories, getDataLayout } from './dataDirectoryManager.js'
import * as dockerManager from './dockerManager.js'
import {
  createMissionSessionCredentials,
  deleteMissionSessionCredentials,
  loadMissionSessionCredentials,
  missionCredentialsToEnv
} from './missionSessionCredentials.js'
import { sanitizeUnixUser } from './utils/sanitize.js'
import { scrubDiagnosticFields, scrubSensitiveText } from './utils/logRedaction.js'
import { classifyCredentialApplyFailure } from './credentialSetupError.js'

export {
  CREDENTIAL_SETUP_STAGES,
  CredentialSetupError,
  classifyCredentialApplyFailure,
  credentialSetupUserMessage,
  extractSshdConfigErrorDetail
} from './credentialSetupError.js'

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** Default: 15 attempts × 2s = 30s */
export const LAB_USER_WAIT_ATTEMPTS = 15
export const LAB_USER_WAIT_DELAY_MS = 2000

/** Bash probe: read SSH banner without sending invalid client data; confirm sshd is alive. */
export const TARGET_SSH_HANDSHAKE_SCRIPT = [
  'set +e',
  'read_ssh_banner() {',
  '  local host="$1"',
  '  local port="$2"',
  '  local line=""',
  '  if command -v nc >/dev/null 2>&1; then',
  '    line=$(echo | nc -w 3 "$host" "$port" 2>/dev/null | head -1 | tr -d "\\r")',
  '    printf "%s" "$line"',
  '    return 0',
  '  fi',
  '  exec 3<>"/dev/tcp/${host}/${port}" 2>/dev/null || return 1',
  '  if read -r -t 3 line <&3 2>/dev/null; then',
  '    line=$(printf "%s" "$line" | tr -d "\\r")',
  '    printf "%s" "$line"',
  '  fi',
  '  exec 3>&- 2>/dev/null || true',
  '}',
  'BANNER=$(read_ssh_banner 127.0.0.1 22)',
  'echo "BANNER=$BANNER"',
  'if echo "$BANNER" | grep -q "^SSH-2.0-"; then HANDSHAKE_OK=yes; else HANDSHAKE_OK=no; fi',
  'echo "HANDSHAKE_OK=$HANDSHAKE_OK"',
  'if pgrep -x sshd >/dev/null 2>&1 || pgrep sshd >/dev/null 2>&1; then SSHD_ALIVE=yes; else SSHD_ALIVE=no; fi',
  'echo "SSHD_ALIVE=$SSHD_ALIVE"'
].join('\n')

/**
 * @param {string} output
 */
export function parseTargetSshHandshake(output) {
  const banner = output.match(/^BANNER=(.*)$/m)?.[1]?.trim() ?? ''
  const handshakeOk = /HANDSHAKE_OK=yes/.test(output) && banner.startsWith('SSH-2.0-')
  const sshdAlive = /SSHD_ALIVE=yes/.test(output)
  return { banner, handshakeOk, sshdAlive }
}

const TARGET_SSH_LISTEN_SCRIPT = [
  'set +e',
  "if ss -tln 2>/dev/null | grep -q ':22 '; then echo 'LISTEN_22=yes'; else echo 'LISTEN_22=no'; fi",
  'if pgrep -x sshd >/dev/null 2>&1 || pgrep sshd >/dev/null 2>&1; then echo "SSHD_ALIVE=yes"; else echo "SSHD_ALIVE=no"; fi'
].join('\n')

/**
 * @param {string} output
 */
export function parseTargetSshListenCheck(output) {
  return {
    listening: /LISTEN_22=yes/.test(output),
    sshdAlive: /SSHD_ALIVE=yes/.test(output)
  }
}

/**
 * Verify SSH is usable inside the lab target (banner probe with listen/sshd -t fallback).
 * @param {string} containerId
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 */
export async function verifyTargetSshReady(containerId, options = {}) {
  const execOpts = { timeout: 15_000, ...dockerExecOptions(options) }

  const handshake = await verifyTargetSshHandshake(containerId, options)
  if (handshake.ok) {
    return { ok: true, method: 'banner', ...handshake }
  }

  const listenResult = await dockerManager.exec(
    containerId,
    ['bash', '-lc', TARGET_SSH_LISTEN_SCRIPT],
    execOpts
  )
  const listenRaw = `${listenResult.stdout ?? ''}\n${listenResult.stderr ?? ''}`.trim()
  const listenParsed = parseTargetSshListenCheck(listenRaw)

  const configTest = await dockerManager.exec(containerId, ['sshd', '-t'], execOpts)
  const configOk = configTest.ok && (configTest.exitCode ?? configTest.code) === 0

  if (listenParsed.listening && listenParsed.sshdAlive && configOk) {
    return {
      ok: true,
      method: 'listen',
      listening: true,
      sshdAlive: true,
      configOk: true,
      handshakeOk: false,
      banner: handshake.banner,
      raw: listenRaw
    }
  }

  return {
    ok: false,
    method: 'none',
    listening: listenParsed.listening,
    sshdAlive: listenParsed.sshdAlive,
    configOk,
    handshakeOk: handshake.handshakeOk,
    banner: handshake.banner,
    raw: `${handshake.raw ?? ''}\n${listenRaw}`.trim()
  }
}

/**
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 */
function dockerExecOptions(options = {}) {
  const runtime = options.dockerRuntime ?? options.runtime
  return runtime ? { dockerRuntime: runtime, runtime } : {}
}

/**
 * Verify SSH responds with a protocol banner and sshd stays running.
 * @param {string} containerId
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 */
export async function verifyTargetSshHandshake(containerId, options = {}) {
  const execOpts = { timeout: 15_000, ...dockerExecOptions(options) }
  const result = await dockerManager.exec(containerId, ['bash', '-lc', TARGET_SSH_HANDSHAKE_SCRIPT], execOpts)
  const raw = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  const parsed = parseTargetSshHandshake(raw)
  return { ...parsed, raw, ok: parsed.handshakeOk && parsed.sshdAlive }
}

/**
 * @param {number} [length]
 */
export function generateLabPassword(length = 16) {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length]
  }
  return out
}

/** @deprecated Use createMissionSessionCredentials */
export function createSessionCredentials(lab, sessionId) {
  return createMissionSessionCredentials(lab, sessionId)
}

/** @deprecated Use loadMissionSessionCredentials */
export function loadSessionCredentials(sessionId) {
  return loadMissionSessionCredentials(sessionId)
}

/** @deprecated Use deleteMissionSessionCredentials */
export function deleteSessionCredentials(sessionId) {
  return deleteMissionSessionCredentials(sessionId)
}

/**
 * Remove all per-session credential files (incomplete attempts).
 * @returns {number}
 */
export function deleteAllSessionCredentials() {
  ensureDataDirectories()
  const dir = getDataLayout().sessions
  if (!fs.existsSync(dir)) return 0
  let removed = 0
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    try {
      fs.rmSync(path.join(dir, file), { force: true })
      removed += 1
    } catch {
      // ignore
    }
  }
  return removed
}

/**
 * Docker env vars for lab entrypoints (never log values).
 * @param {{ username: string, password: string }} credentials
 */
export function credentialsToEnv(credentials) {
  return missionCredentialsToEnv(credentials)
}

/**
 * @param {string} containerId
 * @param {string} username
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 */
export async function verifyLabUserExists(containerId, username, options = {}) {
  const user = sanitizeUnixUser(username)
  const result = await dockerManager.exec(containerId, ['id', user], {
    timeout: 10_000,
    ...dockerExecOptions(options)
  })
  if (!result.ok || (result.exitCode ?? result.code) !== 0) {
    return false
  }
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`
  return out.includes(user) && out.includes('uid=')
}

/**
 * Wait for lab entrypoint / provisioning to create the session user.
 * @param {string} containerId
 * @param {string} username
 * @param {{ attempts?: number, delayMs?: number }} [options]
 */
export async function waitForLabUserExists(containerId, username, options = {}) {
  const attempts = options.attempts ?? LAB_USER_WAIT_ATTEMPTS
  const delayMs = options.delayMs ?? LAB_USER_WAIT_DELAY_MS
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await verifyLabUserExists(containerId, username, options)) {
      return true
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return false
}

/**
 * @param {string} containerId
 * @param {{ attempts?: number, delayMs?: number, dockerRuntime?: string, runtime?: string }} [options]
 */
export async function waitForTargetSshd(containerId, options = {}) {
  const attempts = options.attempts ?? LAB_USER_WAIT_ATTEMPTS
  const delayMs = options.delayMs ?? LAB_USER_WAIT_DELAY_MS
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const ready = await verifyTargetSshReady(containerId, options)
    if (ready.ok) {
      return true
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return false
}

/**
 * @param {string} containerId
 * @param {string} username
 * @param {{ password?: string }} [options]
 */
export async function collectLiveCredentialDiagnostics(containerId, username, options = {}) {
  const user = sanitizeUnixUser(username)
  const secrets = options.password ? [options.password] : []
  const execOpts = { timeout: 20_000, ...dockerExecOptions(options) }

  /** @param {string} label
   *  @param {string[]} cmd */
  async function run(label, cmd) {
    const result = await dockerManager.exec(containerId, cmd, execOpts)
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    return {
      label,
      ok: result.ok && (result.exitCode ?? result.code) === 0,
      exitCode: result.exitCode ?? result.code ?? null,
      output: scrubSensitiveText(combined.slice(0, 4000), secrets)
    }
  }

  const checks = [
    await run(`id ${user}`, ['id', user]),
    await run(`getent passwd ${user}`, ['getent', 'passwd', user]),
    await run(`passwd -S ${user}`, ['passwd', '-S', user]),
    await run(`ls -ld /home/${user}`, ['sh', '-c', `ls -ld "/home/${user}" 2>&1 || echo "missing: /home/${user}"`]),
    await run('listen :22', ['sh', '-c', "ss -tlnp 2>/dev/null | grep ':22' || true"]),
    await run('ps sshd', ['sh', '-c', "ps aux | grep '[s]shd' || true"]),
    await run('sshd_config.d', ['sh', '-c', 'cat /etc/ssh/sshd_config.d/*.conf 2>/dev/null || true']),
    await run('sshd -t', ['sshd', '-t']),
    await run('cat /etc/os-release', ['sh', '-c', 'cat /etc/os-release 2>/dev/null || echo missing']),
    await run('which useradd', ['sh', '-c', 'command -v useradd || echo missing']),
    await run('which chpasswd', ['sh', '-c', 'command -v chpasswd || echo missing']),
    await run('which bash', ['sh', '-c', 'command -v bash || echo missing']),
    await run('which sshd', ['sh', '-c', 'command -v sshd || echo missing']),
    await run('id (root)', ['id']),
    await run('ls -la /home', ['sh', '-c', 'ls -la /home 2>/dev/null || true']),
    await run('env SGQ_USERNAME set', [
      'sh',
      '-c',
      'if [ -n "${SGQ_USERNAME:-}" ]; then echo "SGQ_USERNAME is set"; else echo "SGQ_USERNAME is NOT set"; fi'
    ]),
    await run(`chage -l ${user}`, ['sh', '-c', `chage -l "${user}" 2>&1 || echo "chage unavailable"`])
  ]

  const report = checks
    .map((c) => `--- ${c.label} (exit ${c.exitCode ?? '?'}) ---\n${c.output || '(no output)'}`)
    .join('\n\n')

  return { username: user, checks, report }
}

/**
 * @param {string} containerId
 * @param {string} username
 */
export async function collectTargetUserDiagnostics(containerId, username) {
  const live = await collectLiveCredentialDiagnostics(containerId, username)
  return { username: live.username, checks: live.checks, report: live.report }
}

const ENSURE_LAB_SUDO_SCRIPT = [
  'u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"',
  'if [ -n "$u" ] && [ "$u" != "root" ] && command -v sudo >/dev/null 2>&1; then',
  '  if type configure_lab_user_sudo >/dev/null 2>&1; then',
  '    configure_lab_user_sudo "$u" || true',
  '  else',
  '    getent group sudo >/dev/null 2>&1 && usermod -aG sudo "$u" 2>/dev/null || true',
  '    getent group wheel >/dev/null 2>&1 && usermod -aG wheel "$u" 2>/dev/null || true',
  '    if [ -d /etc/sudoers.d ]; then',
  '      printf "%s ALL=(ALL) NOPASSWD:ALL\\n" "$u" > /etc/sudoers.d/99-sgq-lab-session',
  '      chmod 440 /etc/sudoers.d/99-sgq-lab-session',
  '      command -v visudo >/dev/null 2>&1 && visudo -cf /etc/sudoers.d/99-sgq-lab-session >/dev/null 2>&1 || true',
  '    fi',
  '  fi',
  'fi'
].join('\n')

const APPLY_USER_SCRIPT = [
  'set -e',
  'if [ ! -f /usr/local/bin/apply-lab-credentials.sh ]; then',
  '  echo "applyLabCredentialsInContainer: /usr/local/bin/apply-lab-credentials.sh missing" >&2',
  '  exit 127',
  'fi',
  '. /usr/local/bin/apply-lab-credentials.sh',
  'apply_lab_credentials',
  ENSURE_LAB_SUDO_SCRIPT,
  'install_lab_session_helpers',
  'configure_mission_sshd',
  'reload_mission_sshd || true',
  'id "${SGQ_USERNAME:-${LAB_USERNAME:-}}"'
].join('\n')

const ENSURE_LAB_HELPERS_SCRIPT = [
  'if [ ! -f /usr/local/bin/apply-lab-credentials.sh ]; then exit 0; fi',
  '. /usr/local/bin/apply-lab-credentials.sh',
  'install_lab_session_helpers'
].join('\n')

/**
 * @param {string} containerId
 * @param {string} script
 * @param {{ username: string, password: string }} credentials
 * @param {string} label
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 */
async function execCredentialScript(containerId, script, credentials, label, options = {}) {
  const username = sanitizeUnixUser(credentials?.username ?? '')
  const password = credentials?.password ?? ''
  const env = missionCredentialsToEnv({
    sessionId: 'apply',
    labId: 'apply',
    username,
    password
  })

  const result = await dockerManager.exec(containerId, ['bash', '-lc', script], {
    timeout: 60_000,
    env,
    ...dockerExecOptions(options)
  })

  const exitCode = result.exitCode ?? result.code ?? 1
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const ok = result.ok && exitCode === 0

  return {
    ok,
    exitCode,
    stdout: scrubSensitiveText(stdout, [password]),
    stderr: scrubSensitiveText(stderr, [password]),
    command: `docker exec -e SGQ_USERNAME=… -e SGQ_PASSWORD=… ${containerId} bash -lc '<${label}>'`,
    phase: label
  }
}

/**
 * Re-run credential scripts inside a running lab-target (primary provisioning path).
 * @param {string} containerId
 * @param {{ username: string, password: string }} credentials
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 */
export async function applyLabCredentialsInContainer(containerId, credentials, options = {}) {
  const username = sanitizeUnixUser(credentials?.username ?? '')
  const password = credentials?.password ?? ''
  if (!username || !password) {
    return {
      ok: false,
      exitCode: 1,
      stdout: '',
      stderr: 'Missing username or password for credential injection',
      command: 'applyLabCredentialsInContainer',
      phase: 'apply'
    }
  }

  return execCredentialScript(containerId, APPLY_USER_SCRIPT, credentials, 'apply_lab_credentials', options)
}

/**
 * Ensure mark-lab-complete and related helpers exist on the lab target.
 * @param {string} containerId
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 */
export async function ensureLabSessionHelpers(containerId, options = {}) {
  const result = await dockerManager.exec(
    containerId,
    ['bash', '-lc', ENSURE_LAB_HELPERS_SCRIPT],
    { timeout: 30_000, ...dockerExecOptions(options) }
  )
  return {
    ok: result.ok,
    exitCode: result.exitCode ?? result.code ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    phase: 'ensure_lab_helpers'
  }
}

/**
 * Diagnostics when SSH connections reset or sshd checks fail (passwords redacted by caller).
 * @param {string} containerId
 */
export async function collectTargetSshResetDiagnostics(containerId) {
  /** @param {string} label @param {string[]} cmd */
  async function run(label, cmd) {
    const result = await dockerManager.exec(containerId, cmd, { timeout: 25_000 })
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    return {
      label,
      ok: result.ok && (result.exitCode ?? result.code) === 0,
      exitCode: result.exitCode ?? result.code ?? null,
      output: combined.slice(0, 4000)
    }
  }

  /** @type {{ label: string, ok: boolean, exitCode: number | null, output: string }[]} */
  const checks = []

  try {
    const inspect = await dockerManager.inspectContainerDiagnostics(containerId)
    checks.push({
      label: 'docker inspect (security)',
      ok: true,
      exitCode: 0,
      output: [
        `Privileged: ${inspect.privileged}`,
        `ReadonlyRootfs: ${inspect.readonlyRootfs}`,
        `CapAdd: ${(inspect.capAdd ?? []).join(', ') || '(default)'}`,
        `CapDrop: ${(inspect.capDrop ?? []).join(', ') || '(none)'}`,
        `SecurityOpt: ${(inspect.securityOpt ?? []).join(', ') || '(none)'}`,
        `NetworkMode: ${inspect.networkMode ?? 'unknown'}`
      ].join('\n')
    })
  } catch (err) {
    checks.push({
      label: 'docker inspect (security)',
      ok: false,
      exitCode: 1,
      output: err instanceof Error ? err.message : String(err)
    })
  }

  checks.push(
    await run('sshd -t', ['sshd', '-t']),
    await run('sshd -T (effective)', ['sh', '-c', '/usr/sbin/sshd -T 2>/dev/null | head -40 || sshd -T 2>/dev/null | head -40 || true']),
    await run('SSH handshake (local)', ['bash', '-lc', TARGET_SSH_HANDSHAKE_SCRIPT]),
    await run('ps sshd', ['sh', '-c', "ps aux | grep '[s]shd' || true"]),
    await run('listen :22', ['sh', '-c', "ss -lntp 2>/dev/null | grep ':22' || true"]),
    await run('process capabilities', ['sh', '-c', 'grep -E "^Cap" /proc/self/status 2>/dev/null || true']),
    await run('/run permissions', ['sh', '-c', 'ls -ld /run /run/sshd /tmp 2>/dev/null || true']),
    await run('99-sgq.conf', ['sh', '-c', 'cat /etc/ssh/sshd_config.d/99-sgq.conf 2>/dev/null || echo "(missing)"']),
    await run('UsePrivilegeSeparation grep', [
      'sh',
      '-c',
      "grep -R 'UsePrivilegeSeparation' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null || echo '(none found)'"
    ]),
    await run('sshd_config.d', ['sh', '-c', 'cat /etc/ssh/sshd_config.d/*.conf 2>/dev/null || true']),
    await run('main sshd_config (head)', ['sh', '-c', 'head -80 /etc/ssh/sshd_config 2>/dev/null || true'])
  )

  const logs = await dockerManager.getContainerLogs(containerId, { tail: 80 })
  checks.push({
    label: 'container logs (tail)',
    ok: true,
    exitCode: 0,
    output: (logs.logs ?? '').slice(0, 4000)
  })

  const report = checks
    .map((c) => `--- ${c.label} (exit ${c.exitCode ?? '?'}) ---\n${c.output || '(no output)'}`)
    .join('\n\n')

  return { checks, report }
}

/**
 * @param {string} containerId
 * @param {string} username
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 */
async function isTargetCredentialStateHealthy(containerId, username, options = {}) {
  const user = sanitizeUnixUser(username)
  const userOk = await verifyLabUserExists(containerId, user, options)
  if (!userOk) return false

  const handshake = await verifyTargetSshReady(containerId, options)
  if (!handshake.ok) return false

  const shellCheck = await dockerManager.exec(
    containerId,
    ['getent', 'passwd', user],
    { timeout: 10_000, ...dockerExecOptions(options) }
  )
  const passwdLine = `${shellCheck.stdout ?? ''}`.trim()
  if (!passwdLine.includes(user) || !/\/bin\/(bash|sh)$/.test(passwdLine)) {
    return false
  }

  return true
}

/**
 * Wait until the generated user exists in the lab target (apply + retry).
 * @param {string} containerId
 * @param {string} username
 * @param {{ attempts?: number, delayMs?: number, credentials?: { username: string, password: string }, dockerRuntime?: string, runtime?: string }} [options]
 */
export async function ensureTargetLabUser(containerId, username, options = {}) {
  const user = sanitizeUnixUser(username)
  const credentials = options.credentials ?? { username: user, password: '' }

  const applyResult = await applyLabCredentialsInContainer(containerId, credentials, options)
  const userExists = await verifyLabUserExists(containerId, user, options)

  if (!applyResult.ok) {
    const recovered = await isTargetCredentialStateHealthy(containerId, user, options)
    if (recovered) {
      await ensureLabSessionHelpers(containerId, options).catch(() => null)
      console.info('[sysadmin-game]:credentialManager', 'Apply script failed but target SSH state is healthy — continuing', {
        containerId,
        username: user,
        exitCode: applyResult.exitCode
      })
      return { ok: true, applyResult, userExists: true, recovered: true }
    }

    const failure = classifyCredentialApplyFailure({
      stdout: applyResult.stdout,
      stderr: applyResult.stderr,
      userExists
    })

    console.error(
      '[sysadmin-game]:credentialManager',
      'Credential setup failed',
      scrubDiagnosticFields(
        {
          containerId,
          username: user,
          stage: failure.stage,
          userExists,
          exitCode: applyResult.exitCode,
          stderr: applyResult.stderr?.slice(0, 4000) ?? '',
          stdout: applyResult.stdout?.slice(0, 4000) ?? ''
        },
        [credentials.password]
      )
    )

    const live = await collectLiveCredentialDiagnostics(containerId, user, {
      password: credentials.password
    })

    return {
      ok: false,
      stage: failure.stage,
      message: failure.message,
      detail: failure.detail,
      userExists,
      applyResult,
      live
    }
  }

  const exists = userExists || (await waitForLabUserExists(containerId, user, options))
  if (exists) {
    await ensureLabSessionHelpers(containerId, options).catch(() => null)
    return { ok: true, applyResult, userExists: true }
  }

  const live = await collectLiveCredentialDiagnostics(containerId, user, {
    password: credentials.password
  })
  const failure = classifyCredentialApplyFailure({
    stdout: applyResult.stdout,
    stderr: applyResult.stderr,
    userExists: false
  })

  return {
    ok: false,
    stage: failure.stage,
    message: failure.message,
    detail: failure.detail,
    userExists: false,
    applyResult,
    live
  }
}

/**
 * Ensure the generated lab user exists in the lab workstation container.
 * @param {string} containerId
 * @param {string} username
 * @param {{ platform?: 'linux' | 'windows' }} [options]
 */
export async function ensureWorkstationLabUser(containerId, username, options = {}) {
  const platform = options.platform ?? 'linux'
  const user = sanitizeUnixUser(username)
  const password = options.password ?? ''

  if (platform === 'windows') {
    const script = [
      `$u = '${user.replace(/'/g, "''")}'`,
      '$pw = $env:LAB_PASSWORD',
      'if (-not $pw) { $pw = $env:SGQ_PASSWORD }',
      'if (-not (Get-LocalUser -Name $u -ErrorAction SilentlyContinue)) {',
      "  if (-not $pw) { throw 'LAB_PASSWORD is required for Windows workstation user setup' }",
      '  $sec = ConvertTo-SecureString $pw -AsPlainText -Force',
      '  New-LocalUser -Name $u -Password $sec -FullName "Lab User" | Out-Null',
      "  Add-LocalGroupMember -Group 'Users' -Member $u",
      '}',
      'New-Item -ItemType Directory -Force -Path "C:\\Users\\$u" | Out-Null',
      'Get-LocalUser -Name $u | Select-Object -ExpandProperty Name'
    ].join('; ')
    const result = await dockerManager.exec(
      containerId,
      ['powershell.exe', '-NoProfile', '-Command', script],
      { timeout: 45_000 }
    )
    const out = `${result.stdout ?? ''}`.trim()
    return result.ok && (result.exitCode ?? result.code) === 0 && out === user
  }

  const script = [
    'set -e',
    `u="${user}"`,
    'p="${SGQ_PASSWORD:-${LAB_PASSWORD:-}}"',
    'if ! id "$u" >/dev/null 2>&1; then',
    '  useradd -m -s /bin/bash -d "/home/$u" "$u"',
    'fi',
    'mkdir -p "/home/$u"',
    'chown -R "$u:$u" "/home/$u"',
    'if [ -n "$p" ]; then',
    '  printf "%s:%s\\n" "$u" "$p" | chpasswd',
    '  passwd -u "$u" 2>/dev/null || true',
    'fi',
    'usermod -s /bin/bash "$u" 2>/dev/null || true',
    'getent passwd "$u"',
    'id "$u"'
  ].join('\n')
  const result = await dockerManager.exec(containerId, ['bash', '-c', script], {
    timeout: 30_000,
    env: password ? { SGQ_PASSWORD: password, LAB_PASSWORD: password } : undefined
  })
  return result.ok && (result.exitCode ?? result.code) === 0
}

/**
 * @param {string} sessionId
 */
export function redactCredentialsForClient(sessionId) {
  const record = loadMissionSessionCredentials(sessionId)
  if (!record) return null
  return {
    username: record.username,
    password: record.password,
    host: record.loopbackHost ?? '127.0.0.1',
    sshPort: record.sshPort,
    terminalSshHost: record.terminalSshHost,
    sshReady: record.sshReady === true,
    labOnly: true
  }
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as dockerManager from './dockerManager.js'
import { collectLiveCredentialDiagnostics } from './credentialManager.js'
import { CREDENTIAL_SETUP_STAGES, credentialSetupUserMessage } from './credentialSetupError.js'
import { INTERNAL_SSH_CONTAINER_PORT } from './labPorts.js'
import { scrubSensitiveText } from './utils/logRedaction.js'

/**
 * @param {string[]} hosts
 * @param {string} user
 * @param {number} port
 */
function buildWorkstationVerifyScript(hosts, user, port) {
  const hostList = hosts.filter(Boolean).join(' ')
  const sshOpts = [
    '-o StrictHostKeyChecking=no',
    '-o UserKnownHostsFile=/dev/null',
    '-o ConnectTimeout=8',
    '-o PreferredAuthentications=password',
    '-o PubkeyAuthentication=no'
  ].join(' ')

  return [
    'set +e',
    'echo "SSHPASS_PROVIDED=$([ -n \\"${SSHPASS:-}\\" ] && echo yes || echo no)"',
    'echo "=== sshpass ==="',
    'if command -v sshpass >/dev/null 2>&1; then echo "installed: yes"; sshpass -V 2>&1; else echo "installed: no"; fi',
    'echo "=== target ==="',
    `echo "TARGET_HOSTS=${hostList}"`,
    `echo "TARGET_PORT=${port}"`,
    `echo "USERNAME=${user}"`,
    'printf "%s" "$SSHPASS" > /tmp/.sgq-sshpass',
    'chmod 600 /tmp/.sgq-sshpass',
    'WHOAMI=""',
    'SSH_EXIT=255',
    'USED_HOST=""',
    `for HOST in ${hostList}; do`,
    '  echo "=== ping $HOST ==="',
    '  ping -c 1 -W 2 "$HOST" 2>&1',
    '  echo "PING_EXIT=$?"',
    '  echo "=== nc $HOST ==="',
    `  nc -vz -w 2 "$HOST" ${port} 2>&1`,
    '  echo "NC_EXIT=$?"',
    '  echo "=== ssh login $HOST ==="',
    `  WHOAMI=$(sshpass -f /tmp/.sgq-sshpass ssh -tt ${sshOpts} ${user}@"$HOST" whoami 2>/tmp/ssh-login.err)`,
    '  SSH_EXIT=$?',
    '  cat /tmp/ssh-login.err 2>/dev/null || true',
    '  if [ "$SSH_EXIT" -eq 0 ] && [ -n "$WHOAMI" ]; then',
    '    USED_HOST="$HOST"',
    '    break',
    '  fi',
    `  SSHPASS="$SSHPASS" sshpass -f /tmp/.sgq-sshpass ssh -vvv ${sshOpts} ${user}@"$HOST" true 2>&1 || true`,
    'done',
    'rm -f /tmp/.sgq-sshpass /tmp/ssh-login.err',
    'echo "USED_HOST=$USED_HOST"',
    'echo "WHOAMI=$WHOAMI"',
    'echo "SSH_EXIT=$SSH_EXIT"'
  ].join('\n')
}

/**
 * @param {string} output
 */
function parseVerifyOutput(output) {
  const sshExitMatches = [...output.matchAll(/SSH_EXIT=(\d+)/g)]
  const sshExit = Number(sshExitMatches.at(-1)?.[1] ?? NaN)
  const sshpassInstalled = /installed: yes/.test(output)
  const whoami = output.match(/^WHOAMI=(.*)$/m)?.[1]?.trim() ?? ''
  const usedHost = output.match(/^USED_HOST=(.*)$/m)?.[1]?.trim() ?? ''
  const ncOk =
    /NC_EXIT=0/.test(output) ||
    /Connection to .* 22 port .* succeeded!/i.test(output) ||
    /TcpTestSucceeded\s*:\s*True/i.test(output)
  const pingOk = /1 packets transmitted, 1 received/i.test(output) || /NC_EXIT=0/.test(output)
  const toolsInstalled =
    sshpassInstalled || /plink[\s\S]*installed: yes/i.test(output) || /=== plink ===[\s\S]*installed: yes/i.test(output)

  return {
    sshpassInstalled: toolsInstalled,
    pingOk,
    ncOk,
    pingExit: pingOk ? 0 : 1,
    ncExit: ncOk ? 0 : 1,
    sshExit: Number.isFinite(sshExit) ? sshExit : null,
    sshOutput: output.split('=== ssh login')[1]?.trim() ?? output,
    whoami,
    usedHost
  }
}

/**
 * @param {object} parsed
 * @param {string} safeUser
 */
function classifyVerifyFailure(parsed, safeUser) {
  if (!parsed.ncOk && !parsed.pingOk) {
    return {
      stage: CREDENTIAL_SETUP_STAGES.SSH_ROUTE_FAILED,
      detail: 'Workstation cannot reach lab-target on the session network'
    }
  }
  if (!parsed.ncOk) {
    return {
      stage: CREDENTIAL_SETUP_STAGES.SSH_ROUTE_FAILED,
      detail: 'Ping ok but TCP port 22 unreachable on lab-target'
    }
  }
  if (!parsed.sshpassInstalled) {
    return {
      stage: CREDENTIAL_SETUP_STAGES.SSH_LOGIN_FAILED,
      detail: 'SSH client tools are not available in lab-workstation'
    }
  }
  if (parsed.sshExit !== 0) {
    const authHint = parsed.sshOutput.match(/Permission denied|Authentication failed|No supported authentication|Connection refused|Could not resolve/i)?.[0]
    return {
      stage: CREDENTIAL_SETUP_STAGES.SSH_LOGIN_FAILED,
      detail: authHint ?? `ssh exited with code ${parsed.sshExit ?? '?'}`
    }
  }
  if (parsed.whoami !== safeUser) {
    return {
      stage: CREDENTIAL_SETUP_STAGES.SSH_LOGIN_FAILED,
      detail: `whoami returned "${parsed.whoami || '(empty)'}" expected "${safeUser}"`
    }
  }
  return {
    stage: CREDENTIAL_SETUP_STAGES.SSH_LOGIN_FAILED,
    detail: 'SSH login verification failed'
  }
}

/**
 * @param {object} params
 */
function buildVerifyReport(params) {
  const lines = [
    '=== Workstation SSH verification ===',
    `Target hosts tried: ${params.targetHosts}`,
    `Connected host: ${params.usedHost || '(none)'}`,
    `Target port: ${params.targetPort}`,
    `Username: ${params.username}`,
    `Password provided: ${params.passwordProvided ? 'yes' : 'no'}`,
    `sshpass installed: ${params.sshpassInstalled ? 'yes' : 'no'}`,
    `ssh exit: ${params.sshExit ?? '?'}`,
    `whoami: ${params.whoami || '(empty)'}`,
    '',
    '--- workstation verify output ---',
    params.rawOutput || '(no output)',
    ''
  ]
  if (params.targetReport) {
    lines.push('--- lab target diagnostics ---', params.targetReport, '')
  }
  return lines.join('\n').slice(0, 16000)
}

/**
 * @param {string[]} hosts
 * @param {string} user
 * @param {number} port
 */
function buildWindowsWorkstationVerifyScript(hosts, user, port) {
  const hostList = hosts.filter(Boolean).map((h) => `'${h.replace(/'/g, "''")}'`).join(', ')
  const safeUser = user.replace(/'/g, "''")
  return [
    '$ErrorActionPreference = "Continue"',
    `$hosts = @(${hostList})`,
    `$user = '${safeUser}'`,
    `$port = ${port}`,
    '$pw = $env:LAB_PASSWORD',
    'if (-not $pw) { $pw = $env:SGQ_PASSWORD }',
    'Write-Host "SSHPASS_PROVIDED=$(if ($pw) { \'yes\' } else { \'no\' })"',
    'Write-Host "=== plink ==="',
    'if (Test-Path C:\\Tools\\plink.exe) { Write-Host "installed: yes" } else { Write-Host "installed: no" }',
    '$WHOAMI=""',
    '$SSH_EXIT=255',
    '$USED_HOST=""',
    'foreach ($HOST in $hosts) {',
    '  Write-Host "=== Test-NetConnection $HOST ==="',
    "  $tcp = Test-NetConnection -ComputerName $HOST -Port $port -WarningAction SilentlyContinue",
    '  if ($tcp.TcpTestSucceeded) { Write-Host "NC_EXIT=0" } else { Write-Host "NC_EXIT=1" }',
    '  Write-Host "=== ssh login $HOST ==="',
    '  if (Test-Path C:\\Tools\\plink.exe -and $pw) {',
    "    $WHOAMI = & C:\\Tools\\plink.exe -batch -pw $pw ${user}@$HOST whoami 2>&1",
    '    if ($LASTEXITCODE -eq 0 -and $WHOAMI) { $SSH_EXIT=0; $USED_HOST=$HOST; break }',
    '    $SSH_EXIT=$LASTEXITCODE',
    '  }',
    '}',
    'Write-Host "USED_HOST=$USED_HOST"',
    'Write-Host "WHOAMI=$WHOAMI"',
    'Write-Host "SSH_EXIT=$SSH_EXIT"'
  ].join('\n')
}

/**
 * Verify TCP :22 and password SSH login from lab-workstation to lab-target.
 * @param {{ workstationContainerId: string, targetContainerId?: string, targetInternalIp: string, targetHostnames?: string[], username: string, password: string, workstationPlatform?: 'linux' | 'windows', attempts?: number, delayMs?: number }} params
 */
export async function verifyWorkstationSshToTarget(params) {
  const {
    workstationContainerId,
    targetContainerId,
    targetInternalIp,
    targetHostnames = ['lab-target'],
    username,
    password,
    workstationPlatform = 'linux',
    attempts: maxAttempts = 15,
    delayMs = 2000
  } = params

  const safeIp = targetInternalIp.replace(/[^0-9a-fA-F.:]/g, '')
  const safeUser = username.replace(/[^a-zA-Z0-9._-]/g, '')
  const port = INTERNAL_SSH_CONTAINER_PORT
  const hosts = [...new Set([...targetHostnames.map((h) => h.replace(/[^a-zA-Z0-9.-]/g, '')), safeIp].filter(Boolean))]

  if (!hosts.length || !safeUser || !password) {
    return {
      ok: false,
      portOpen: false,
      loginOk: false,
      routeOk: false,
      stage: CREDENTIAL_SETUP_STAGES.SSH_LOGIN_FAILED,
      detail: 'Missing target host, username, or password for SSH verification',
      message: credentialSetupUserMessage(CREDENTIAL_SETUP_STAGES.SSH_LOGIN_FAILED, 'missing credentials'),
      report: 'Workstation SSH verification skipped: missing host, username, or password.'
    }
  }

  const isWindows = workstationPlatform === 'windows'
  const verifyScript = isWindows
    ? buildWindowsWorkstationVerifyScript(hosts, safeUser, port)
    : buildWorkstationVerifyScript(hosts, safeUser, port)
  let lastParsed = /** @type {ReturnType<typeof parseVerifyOutput> | null} */ (null)
  let lastRaw = ''

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = isWindows
      ? await dockerManager.exec(
          workstationContainerId,
          ['powershell.exe', '-NoProfile', '-Command', verifyScript],
          { timeout: 60_000, env: { LAB_PASSWORD: password, SGQ_PASSWORD: password } }
        )
      : await dockerManager.exec(
          workstationContainerId,
          ['bash', '-lc', verifyScript],
          { timeout: 45_000, env: { SSHPASS: password, LAB_PASSWORD: password } }
        )

    const raw = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
    lastRaw = scrubSensitiveText(raw, [password])
    lastParsed = parseVerifyOutput(lastRaw)

    const routeOk = lastParsed.ncOk
    const loginOk = isWindows
      ? lastParsed.sshExit === 0 && lastParsed.whoami.toLowerCase() === safeUser.toLowerCase()
      : lastParsed.sshpassInstalled &&
        lastParsed.sshExit === 0 &&
        lastParsed.whoami === safeUser

    if (routeOk && loginOk) {
      return {
        ok: true,
        portOpen: true,
        loginOk: true,
        routeOk: true,
        stage: null,
        detail: null,
        message: null,
        report: buildVerifyReport({
          targetHosts: hosts.join(', '),
          usedHost: lastParsed.usedHost,
          targetPort: port,
          username: safeUser,
          passwordProvided: true,
          sshpassInstalled: lastParsed.sshpassInstalled,
          sshExit: lastParsed.sshExit,
          whoami: lastParsed.whoami,
          rawOutput: lastRaw
        }),
        diagnostics: lastParsed
      }
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  const parsed = lastParsed ?? parseVerifyOutput(lastRaw)
  const failure = classifyVerifyFailure(parsed, safeUser)
  const message = credentialSetupUserMessage(failure.stage, failure.detail)

  let targetReport = ''
  if (targetContainerId) {
    const targetDiag = await collectLiveCredentialDiagnostics(targetContainerId, safeUser, {
      password
    })
    targetReport = targetDiag.report
  }

  const report = buildVerifyReport({
    targetHosts: hosts.join(', '),
    usedHost: parsed.usedHost,
    targetPort: port,
    username: safeUser,
    passwordProvided: Boolean(password),
    sshpassInstalled: parsed.sshpassInstalled,
    sshExit: parsed.sshExit,
    whoami: parsed.whoami,
    rawOutput: lastRaw,
    targetReport
  })

  return {
    ok: false,
    portOpen: parsed.ncOk,
    loginOk: parsed.sshExit === 0 && parsed.whoami === safeUser,
    routeOk: parsed.ncOk,
    stage: failure.stage,
    detail: failure.detail,
    message,
    report,
    diagnostics: parsed
  }
}

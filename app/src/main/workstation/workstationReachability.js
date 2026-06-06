/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as dockerManager from '../dockerManager.js'
import {
  collectTargetSshResetDiagnostics,
  parseTargetSshHandshake,
  TARGET_SSH_HANDSHAKE_SCRIPT,
  verifyTargetSshReady
} from '../credentialManager.js'
import { CREDENTIAL_SETUP_STAGES, credentialSetupUserMessage } from '../credentialSetupError.js'
import { INTERNAL_SSH_CONTAINER_PORT } from '../labPorts.js'
import { logger } from '../utils/logger.js'

const TARGET_SSH_CHECK_SCRIPT = [
  'set +e',
  'echo "=== sshd -t ==="',
  'if command -v sshd >/dev/null 2>&1; then sshd -t 2>&1; else echo "sshd binary missing"; fi',
  'echo "SSHD_T_EXIT=$?"',
  'echo "=== listener :22 ==="',
  'if command -v ss >/dev/null 2>&1; then',
  "  ss -tlnp 2>/dev/null | grep ':22 ' || true",
  'elif command -v netstat >/dev/null 2>&1; then',
  "  netstat -tln 2>/dev/null | grep ':22 ' || true",
  'else',
  '  echo "no ss/netstat"',
  'fi',
  "if ss -tln 2>/dev/null | grep -q ':22 '; then echo 'LISTEN_22=yes'; elif netstat -tln 2>/dev/null | grep -q ':22 '; then echo 'LISTEN_22=yes'; else echo 'LISTEN_22=no'; fi",
  'echo "=== ssh handshake ==="',
  TARGET_SSH_HANDSHAKE_SCRIPT
].join('\n')

/**
 * @param {string[]} hosts
 * @param {number} port
 */
function buildLinuxRouteScript(hosts, port) {
  const hostList = hosts.filter(Boolean).join(' ')
  return [
    'set +e',
    `echo "TARGET_HOSTS=${hostList}"`,
    `echo "TARGET_PORT=${port}"`,
    'ROUTE_OK=no',
    'PING_OK=no',
    `for HOST in ${hostList}; do`,
    '  echo "=== getent $HOST ==="',
    '  getent hosts "$HOST" 2>&1 || true',
    '  echo "=== ping -c 1 $HOST ==="',
    '  if ping -c 1 -w 3 "$HOST" >/dev/null 2>&1; then PING_OK=yes; else PING_OK=no; fi',
    '  echo "PING_OK=$PING_OK"',
  '  echo "=== nc $HOST ==="',
  `  nc -zv -w 3 "$HOST" ${port} 2>&1`,
  '  NC_EXIT=$?',
  '  BANNER=""',
  '  if [ "$NC_EXIT" -eq 0 ]; then',
  `    BANNER=$(echo | nc -w 3 "$HOST" ${port} 2>/dev/null | head -1 | tr -d "\\r")`,
  '    echo "BANNER=$BANNER"',
  '    if echo "$BANNER" | grep -q "^SSH-2.0-"; then HANDSHAKE_OK=yes; else HANDSHAKE_OK=no; fi',
  '    echo "HANDSHAKE_OK=$HANDSHAKE_OK"',
  '  fi',
  '  if [ "$NC_EXIT" -eq 0 ] && [ "$HANDSHAKE_OK" = "yes" ]; then ROUTE_OK=yes; USED_HOST="$HOST"; break; fi',
    'done',
    'echo "ROUTE_OK=$ROUTE_OK"',
    'echo "USED_HOST=$USED_HOST"'
  ].join('\n')
}

/**
 * @param {string[]} hosts
 * @param {number} port
 */
function buildWindowsRouteScript(hosts, port) {
  const hostList = hosts.map((h) => `'${h.replace(/'/g, "''")}'`).join(', ')
  return [
    '$ErrorActionPreference = "Continue"',
    `$hosts = @(${hostList})`,
    `$port = ${port}`,
    '$ROUTE_OK=no',
    '$USED_HOST=""',
    'foreach ($HOST in $hosts) {',
    '  Write-Host "=== Resolve $HOST ==="',
    '  try { [void][System.Net.Dns]::GetHostAddresses($HOST) } catch { Write-Host $_.Exception.Message }',
    '  Write-Host "=== Test-NetConnection $HOST ==="',
    '  $tcp = Test-NetConnection -ComputerName $HOST -Port $port -WarningAction SilentlyContinue',
    '  if ($tcp.TcpTestSucceeded) { $ROUTE_OK="yes"; $USED_HOST=$HOST; break }',
    '}',
    'Write-Host "ROUTE_OK=$ROUTE_OK"',
    'Write-Host "USED_HOST=$USED_HOST"'
  ].join('\n')
}

/**
 * @param {string} output
 */
function parseTargetSshCheck(output) {
  const sshdTExit = Number(output.match(/^SSHD_T_EXIT=(\d+)/m)?.[1] ?? NaN)
  const sshdTOk = sshdTExit === 0
  const listening = /LISTEN_22=yes/.test(output)
  const handshake = parseTargetSshHandshake(output)
  return { sshdTOk, listening, sshdTExit, ...handshake }
}

/**
 * @param {string} output
 */
function parseRouteCheck(output) {
  const routeOk = /ROUTE_OK=yes/.test(output)
  const usedHost = output.match(/^USED_HOST=(.*)$/m)?.[1]?.trim() ?? ''
  const ncOk = /NC_EXIT=0/.test(output) || /TcpTestSucceeded\s*:\s*True/i.test(output) || routeOk
  return { routeOk, ncOk, usedHost }
}

/**
 * @param {string} targetContainerId
 * @param {{ dockerRuntime?: string, runtime?: string }} [options]
 */
export async function verifyTargetSshService(targetContainerId, options = {}) {
  const execOpts = {
    timeout: 30_000,
    dockerRuntime: options.dockerRuntime ?? options.runtime
  }
  const ready = await verifyTargetSshReady(targetContainerId, execOpts)
  const result = await dockerManager.exec(targetContainerId, ['bash', '-lc', TARGET_SSH_CHECK_SCRIPT], execOpts)
  const raw = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  const parsed = parseTargetSshCheck(raw)
  const logs = await dockerManager.getContainerLogs(targetContainerId, {
    tail: 80,
    dockerRuntime: options.dockerRuntime ?? options.runtime
  })
  const logText = logs.logs ?? ''
  const preauthFailure = /chroot\(["']?\/run\/sshd["']?\).*Operation not permitted|UsePrivilegeSeparation|Connection reset by .* port 22/i.test(
    logText
  )
  const postAuthAuditFailure = /linux_audit_write_entry failed|syslogin_perform_logout: logout\(\) returned an error/i.test(
    logText
  )

  if (postAuthAuditFailure) {
    const diagnostics = await collectTargetSshResetDiagnostics(targetContainerId)
    return {
      ok: false,
      stage: CREDENTIAL_SETUP_STAGES.SSH_CONNECTION_RESET,
      detail:
        'sshd accepted the password but closed the interactive session (OpenSSH audit login recording needs CAP_AUDIT_WRITE in the container)',
      report: [raw, '', logText.slice(0, 2000), '', diagnostics.report].filter(Boolean).join('\n\n')
    }
  }

  if (preauthFailure) {
    const diagnostics = await collectTargetSshResetDiagnostics(targetContainerId)
    return {
      ok: false,
      stage: CREDENTIAL_SETUP_STAGES.SSH_CONNECTION_RESET,
      detail:
        'sshd closed the connection during pre-auth (OpenSSH preauth sandbox needs CAP_SYS_CHROOT in the container)',
      report: [raw, '', logText.slice(0, 2000), '', diagnostics.report].filter(Boolean).join('\n\n')
    }
  }

  if (ready.ok) {
    return { ok: true, report: raw, method: ready.method ?? 'banner' }
  }

  const diagnostics = await collectTargetSshResetDiagnostics(targetContainerId)
  const stage = !parsed.sshdTOk
    ? CREDENTIAL_SETUP_STAGES.SSHD_CONFIG_FAILED
    : !parsed.listening
      ? CREDENTIAL_SETUP_STAGES.SSHD_START_FAILED
      : CREDENTIAL_SETUP_STAGES.SSH_CONNECTION_RESET
  const detail = !parsed.sshdTOk
    ? 'sshd -t failed inside the lab target'
    : !parsed.listening
      ? 'SSH service is not listening inside the lab target'
      : !parsed.handshakeOk
        ? 'SSH port accepted TCP but did not return an SSH-2.0 banner (connection may reset during pre-auth)'
        : 'sshd exited after a connection attempt'
  return {
    ok: false,
    stage,
    detail,
    report: [raw, '', diagnostics.report].filter(Boolean).join('\n\n')
  }
}

/**
 * @param {{ workstationContainerId: string, targetInternalIp: string, targetHostnames?: string[], workstationPlatform?: string, dockerRuntime?: string, runtime?: string }} params
 */
export async function verifyWorkstationRouteToTarget(params) {
  const {
    workstationContainerId,
    targetInternalIp,
    targetHostnames = ['lab-target'],
    workstationPlatform = 'linux',
    dockerRuntime
  } = params
  const execOpts = {
    timeout: 45_000,
    dockerRuntime: dockerRuntime ?? params.runtime
  }

  const port = INTERNAL_SSH_CONTAINER_PORT
  const hosts = [...new Set([...targetHostnames.filter(Boolean)])]

  if (!hosts.length) {
    return {
      ok: false,
      stage: CREDENTIAL_SETUP_STAGES.SSH_ROUTE_FAILED,
      detail: 'Lab target route could not be resolved',
      report: 'No target hostname or IP available.'
    }
  }

  const isWindows = workstationPlatform === 'windows'
  const script = isWindows ? buildWindowsRouteScript(hosts, port) : buildLinuxRouteScript(hosts, port)
  const result = isWindows
    ? await dockerManager.exec(
        workstationContainerId,
        ['powershell.exe', '-NoProfile', '-Command', script],
        execOpts
      )
    : await dockerManager.exec(workstationContainerId, ['bash', '-lc', script], execOpts)

  const raw = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  const parsed = parseRouteCheck(raw)

  if (!parsed.routeOk) {
    return {
      ok: false,
      stage: CREDENTIAL_SETUP_STAGES.SSH_ROUTE_FAILED,
      detail: `SSH port is not reachable from the selected workstation (port ${port})`,
      report: raw,
      usedHost: parsed.usedHost
    }
  }

  return { ok: true, report: raw, usedHost: parsed.usedHost }
}

/**
 * SSH lab readiness: target sshd listening + route from workstation (no login/auth).
 * @param {{ targetContainerId: string, workstationContainerId: string, targetInternalIp: string, targetHostnames?: string[], workstationPlatform?: string, dockerRuntime?: string, runtime?: string }} params
 */
export async function verifySshLabReachability(params) {
  const dockerOpts = {
    dockerRuntime: params.dockerRuntime ?? params.runtime
  }
  const targetCheck = await verifyTargetSshService(params.targetContainerId, dockerOpts)
  if (!targetCheck.ok) {
    const message = credentialSetupUserMessage(targetCheck.stage, targetCheck.detail ?? undefined)
    return {
      ok: false,
      sshReady: false,
      portOpen: false,
      sshdListening: false,
      routeOk: false,
      stage: targetCheck.stage,
      detail: targetCheck.detail,
      message,
      report: targetCheck.report ?? ''
    }
  }

  const routeCheck = await verifyWorkstationRouteToTarget({
    workstationContainerId: params.workstationContainerId,
    targetInternalIp: params.targetInternalIp,
    targetHostnames: params.targetHostnames,
    workstationPlatform: params.workstationPlatform,
    dockerRuntime: params.dockerRuntime ?? params.runtime
  })

  if (!routeCheck.ok) {
    const message = credentialSetupUserMessage(routeCheck.stage, routeCheck.detail ?? undefined)
    return {
      ok: false,
      sshReady: false,
      portOpen: false,
      sshdListening: true,
      routeOk: false,
      stage: routeCheck.stage,
      detail: routeCheck.detail,
      message,
      report: [targetCheck.report, routeCheck.report].filter(Boolean).join('\n\n')
    }
  }

  logger.info('workstation', 'SSH reachability verified (no login test)', {
    targetInternalIp: params.targetInternalIp,
    usedHost: routeCheck.usedHost
  })

  return {
    ok: true,
    sshReady: true,
    portOpen: true,
    sshdListening: true,
    routeOk: true,
    stage: null,
    detail: null,
    message: null,
    report: [targetCheck.report, routeCheck.report].filter(Boolean).join('\n\n')
  }
}

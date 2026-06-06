/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as dockerManager from './dockerManager.js'
import { collectTargetUserDiagnostics, TARGET_SSH_HANDSHAKE_SCRIPT } from './credentialManager.js'
import { INTERNAL_SSH_CONTAINER_PORT, SANDBOX_SSH_TARGET } from './labPorts.js'
import { loadMissionSessionCredentials } from './missionSessionCredentials.js'
import { scrubSensitiveText } from './utils/logRedaction.js'

/**
 * @param {string} containerId
 * @param {string[]} cmd
 * @param {string} label
 */
async function runTargetCheck(containerId, cmd, label) {
  const result = await dockerManager.exec(containerId, cmd, { timeout: 20_000 })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  return {
    label,
    ok: result.ok && (result.exitCode ?? result.code ?? 1) === 0,
    exitCode: result.exitCode ?? result.code ?? null,
    output: output.slice(0, 4000)
  }
}

/**
 * @param {string} targetContainerId
 * @param {string} sessionId
 * @param {{ helperContainerId?: string | null, networkName?: string | null }} [context]
 */
export async function collectSshDiagnostics(targetContainerId, sessionId, context = {}) {
  const creds = loadMissionSessionCredentials(sessionId)
  const username = creds?.username ?? null
  const targetInternalIp =
    creds?.targetInternalIp ??
    creds?.host ??
    (context.networkName
      ? await dockerManager.getContainerNetworkIp(targetContainerId, context.networkName)
      : null)

  const inspectPorts = await dockerManager.inspectContainerPublishedPorts(targetContainerId)
  const publishedSsh = inspectPorts.find((p) => p.container === 22) ?? null

  const state = await dockerManager.inspectContainerState(targetContainerId).catch(() => null)
  const logs = await dockerManager.getContainerLogs(targetContainerId, { tail: 120 })

  /** @type {{ label: string, ok: boolean, exitCode: number | null, output: string }[]} */
  const checks = []

  try {
    const inspect = await dockerManager.inspectContainerDiagnostics(targetContainerId)
    checks.push({
      label: 'docker inspect (security)',
      ok:
        (inspect.capAdd ?? []).includes('CAP_SYS_CHROOT') &&
        (inspect.capAdd ?? []).includes('CAP_AUDIT_WRITE'),
      exitCode: 0,
      output: [
        `Privileged: ${inspect.privileged}`,
        `ReadonlyRootfs: ${inspect.readonlyRootfs}`,
        `CapAdd: ${(inspect.capAdd ?? []).join(', ') || '(default)'}`,
        `CapDrop: ${(inspect.capDrop ?? []).join(', ') || '(none)'}`,
        `SecurityOpt: ${(inspect.securityOpt ?? []).join(', ') || '(none)'}`
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

  checks.push(await runTargetCheck(targetContainerId, ['sshd', '-t'], 'sshd -t'))
  checks.push(
    await runTargetCheck(
      targetContainerId,
      ['bash', '-lc', TARGET_SSH_HANDSHAKE_SCRIPT],
      'SSH handshake (local)'
    )
  )
  checks.push(
    await runTargetCheck(targetContainerId, ['sh', '-c', 'ps aux | grep [s]shd || true'], 'ps sshd')
  )
  checks.push(
    await runTargetCheck(
      targetContainerId,
      ['sh', '-c', 'ss -tlnp 2>/dev/null | grep :22 || netstat -tlnp 2>/dev/null | grep :22 || true'],
      'listen :22'
    )
  )
  checks.push(
    await runTargetCheck(
      targetContainerId,
      ['sh', '-c', 'cat /etc/ssh/sshd_config.d/99-sgq.conf 2>/dev/null || echo "(missing)"'],
      '99-sgq.conf'
    )
  )
  checks.push(
    await runTargetCheck(
      targetContainerId,
      [
        'sh',
        '-c',
        "grep -R 'UsePrivilegeSeparation' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null || echo '(none found)'"
      ],
      'UsePrivilegeSeparation grep'
    )
  )
  checks.push(
    await runTargetCheck(
      targetContainerId,
      ['sh', '-c', 'ls -ld /run/sshd 2>/dev/null || echo "/run/sshd missing"'],
      '/run/sshd permissions'
    )
  )
  checks.push(
    await runTargetCheck(
      targetContainerId,
      ['sh', '-c', 'head -60 /etc/ssh/sshd_config 2>/dev/null || true'],
      'main sshd_config (head)'
    )
  )
  checks.push(
    await runTargetCheck(
      targetContainerId,
      ['sh', '-c', 'ls -la /etc/ssh/ssh_host_*_key 2>/dev/null || true'],
      'host keys'
    )
  )
  if (username) {
    const targetUserDiag = await collectTargetUserDiagnostics(targetContainerId, username)
    for (const check of targetUserDiag.checks) {
      checks.push({
        label: check.label,
        ok: check.ok,
        exitCode: null,
        output: check.output
      })
    }
  }

  checks.push(
    await runTargetCheck(
      targetContainerId,
      [
        'sh',
        '-c',
        'for f in /var/log/auth.log /var/log/secure; do [ -f "$f" ] && tail -n 40 "$f" && break; done; true'
      ],
      'auth log tail'
    )
  )

  let tcpReady = false
  let loginReady = false
  if (context.helperContainerId) {
    const sshpassCheck = await dockerManager.exec(
      context.helperContainerId,
      ['sh', '-c', 'command -v sshpass >/dev/null && echo yes || echo no; sshpass -V 2>&1 || true'],
      { timeout: 8000 }
    )
    checks.push({
      label: 'sshpass (lab-workstation)',
      ok: /yes/.test(`${sshpassCheck.stdout ?? ''}`),
      exitCode: sshpassCheck.exitCode ?? sshpassCheck.code ?? null,
      output: `${sshpassCheck.stdout ?? ''}${sshpassCheck.stderr ?? ''}`.trim().slice(0, 500)
    })

    const pingHost = SANDBOX_SSH_TARGET
    const ping = await dockerManager.exec(
      context.helperContainerId,
      ['ping', '-c', '1', '-W', '2', pingHost],
      { timeout: 8000 }
    )
    checks.push({
      label: `ping -c 1 ${pingHost} (from lab-workstation)`,
      ok: ping.ok && (ping.exitCode ?? ping.code) === 0,
      exitCode: ping.exitCode ?? ping.code ?? null,
      output: `${ping.stdout ?? ''}${ping.stderr ?? ''}`.trim().slice(0, 500)
    })

    const nc = await dockerManager.exec(
      context.helperContainerId,
      ['nc', '-vz', '-w', '2', pingHost, String(INTERNAL_SSH_CONTAINER_PORT)],
      { timeout: 8000 }
    )
    tcpReady = nc.ok && (nc.exitCode ?? nc.code) === 0
    checks.push({
      label: `nc -vz ${pingHost} ${INTERNAL_SSH_CONTAINER_PORT} (from lab-workstation)`,
      ok: tcpReady,
      exitCode: nc.exitCode ?? nc.code ?? null,
      output: `${nc.stdout ?? ''}${nc.stderr ?? ''}`.trim().slice(0, 500)
    })

    if (targetInternalIp && targetInternalIp !== pingHost) {
      const pingIp = await dockerManager.exec(
        context.helperContainerId,
        ['ping', '-c', '1', '-W', '2', targetInternalIp],
        { timeout: 8000 }
      )
      checks.push({
        label: `ping -c 1 ${targetInternalIp} (debug IP)`,
        ok: pingIp.ok && (pingIp.exitCode ?? pingIp.code) === 0,
        exitCode: pingIp.exitCode ?? pingIp.code ?? null,
        output: `${pingIp.stdout ?? ''}${pingIp.stderr ?? ''}`.trim().slice(0, 500)
      })
    }

    if (username && creds?.password) {
      const safeUser = username.replace(/[^a-zA-Z0-9._-]/g, '')
      const safeHost = SANDBOX_SSH_TARGET
      const loginScript = [
        'set +e',
        'SSH_OUTPUT=$(SSHPASS="$SSHPASS" sshpass -e ssh -tt -vvv \\',
        '  -o StrictHostKeyChecking=no \\',
        '  -o UserKnownHostsFile=/dev/null \\',
        '  -o ConnectTimeout=8 \\',
        '  -o PreferredAuthentications=password \\',
        '  -o PubkeyAuthentication=no \\',
        `  ${safeUser}@${safeHost} whoami 2>&1)`,
        'SSH_EXIT=$?',
        'printf "%s\\n" "$SSH_OUTPUT"',
        'echo "SSH_EXIT=$SSH_EXIT"'
      ].join('\n')
      const login = await dockerManager.exec(
        context.helperContainerId,
        ['bash', '-lc', loginScript],
        {
          timeout: 35_000,
          env: { SSHPASS: creds.password }
        }
      )
      const raw = scrubSensitiveText(`${login.stdout ?? ''}${login.stderr ?? ''}`.trim(), [
        creds.password
      ])
      const sshExit = Number(raw.match(/SSH_EXIT=(\d+)/)?.[1] ?? login.exitCode ?? login.code ?? 1)
      const whoami = raw.replace(/SSH_EXIT=\d+.*$/s, '').trim().split(/\r?\n/).pop()?.trim() ?? ''
      loginReady = sshExit === 0 && whoami === safeUser
      checks.push({
        label: `sshpass ssh -vvv ${safeUser}@${safeHost} (from lab-workstation)`,
        ok: loginReady,
        exitCode: sshExit,
        output: raw.slice(0, 4000)
      })
    }
  }

  const sshdTest = checks.find((c) => c.label === 'sshd -t') ?? { ok: false, output: '' }
  const userCheck = username ? checks.find((c) => c.label === `id ${username}`) : null

  const reportLines = [
    `Session: ${sessionId}`,
    `Target container: ${targetContainerId}`,
    `Network: ${context.networkName ?? 'unknown'}`,
    `Target hostname: ${SANDBOX_SSH_TARGET}`,
    `Internal IP (debug): ${targetInternalIp ?? 'unknown'}`,
    `Container status: ${state?.status ?? 'unknown'}`,
    `TCP :22 from workstation: ${tcpReady ? 'open' : 'closed'}`,
    `SSH login from workstation: ${loginReady ? 'ok' : 'failed'}`,
    '',
    '--- Container logs (tail) ---',
    logs.logs?.slice(0, 3000) ?? '',
    '',
    ...checks.flatMap((check) => [
      `--- ${check.label} (exit ${check.exitCode ?? '?'}) ---`,
      check.output || '(no output)',
      ''
    ])
  ]

  return {
    username,
    targetInternalIp,
    sshPort: INTERNAL_SSH_CONTAINER_PORT,
    hostPublishedSsh: publishedSsh,
    containerId: targetContainerId,
    containerStatus: state?.status ?? 'unknown',
    containerExitCode: state?.exitCode ?? null,
    portMappings: inspectPorts,
    sshdConfigTest: { ok: sshdTest.ok, output: sshdTest.output },
    userExists: userCheck ? { ok: userCheck.ok, output: userCheck.output } : { ok: false, output: '' },
    tcpReady,
    loginReady,
    checks,
    report: reportLines.join('\n'),
    logs: logs.logs?.slice(0, 4000) ?? ''
  }
}

/**
 * @param {string} targetContainerId
 * @param {string} sessionId
 * @param {{ helperContainerId?: string | null, networkName?: string | null }} [context]
 */
export async function testMissionSshReadiness(targetContainerId, sessionId, context = {}) {
  const diag = await collectSshDiagnostics(targetContainerId, sessionId, context)
  return {
    ready:
      diag.tcpReady === true &&
      diag.loginReady === true &&
      diag.userExists?.ok === true &&
      diag.sshdConfigTest?.ok !== false,
    diagnostics: diag
  }
}

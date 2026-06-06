/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { runCommand } from '../utils/exec.js'
import { scrubSensitiveText } from '../utils/logRedaction.js'

/** @type {Record<string, { args: string[], label: string }>} */
const ALLOWED_DIAGNOSTICS = {
  uname: { label: 'uname -a', args: ['-e', 'uname -a'] },
  osRelease: { label: 'os-release', args: ['-e', 'cat /etc/os-release'] },
  whichDocker: { label: 'which docker', args: ['-e', 'which docker'] },
  dockerVersion: { label: 'docker version', args: ['-e', 'docker version'] },
  ipAddr: { label: 'ip addr', args: ['-e', 'ip -o addr show'] }
}

/**
 * @param {string} diagnosticId
 * @param {string} [distro]
 */
export async function runWslDiagnostic(diagnosticId, distro) {
  if (process.platform !== 'win32') {
    return { ok: false, output: '', error: 'WSL diagnostics are only available on Windows.' }
  }

  const spec = ALLOWED_DIAGNOSTICS[diagnosticId]
  if (!spec) {
    return { ok: false, output: '', error: `Unknown diagnostic: ${diagnosticId}` }
  }

  const wslArgs = ['-d', distro && typeof distro === 'string' ? distro : undefined].filter(Boolean)
  wslArgs.push(...spec.args)

  const result = await runCommand('wsl.exe', wslArgs, { timeout: 25_000 })
  const combined = scrubSensitiveText([result.stdout, result.stderr].filter(Boolean).join('\n'))

  return {
    ok: result.ok,
    label: spec.label,
    output: combined.slice(0, 8000),
    error: result.ok ? null : combined || 'WSL command failed'
  }
}

export function listWslDiagnosticIds() {
  return Object.keys(ALLOWED_DIAGNOSTICS)
}

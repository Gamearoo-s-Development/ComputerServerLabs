/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { execFile } from 'child_process'

/**
 * @param {string} command
 * @param {string[]} [args]
 * @param {{ timeout?: number, cwd?: string }} [options]
 */
export function runCommand(command, args = [], options = {}) {
  const { timeout = 8000, cwd } = options

  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout, cwd, windowsHide: true, maxBuffer: 1024 * 512 },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: stdout?.toString().trim() ?? '',
          stderr: stderr?.toString().trim() ?? '',
          code: error?.code ?? 0
        })
      }
    )
  })
}

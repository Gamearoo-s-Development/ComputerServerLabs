/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Workstation container failed to start (Docker/QEMU/desktop VM).
 */
export class WorkstationStartError extends Error {
  /**
   * @param {string} message User-facing summary
   * @param {{ stage?: string, report?: string, containerId?: string | null, containerName?: string | null, hints?: string[] }} diagnostics
   */
  constructor(message, diagnostics = {}) {
    super(message)
    this.name = 'WorkstationStartError'
    this.stage = diagnostics.stage ?? 'workstation_start_failed'
    this.diagnostics = diagnostics
  }
}

/*

 * This Source Code Form is subject to the terms of the Mozilla Public

 * License, v. 2.0. If a copy of the MPL was not distributed with this

 * file, You can obtain one at https://mozilla.org/MPL/2.0/.

 */



import { sessionIsTargetOnlyLab } from '../lab/labMode.js'
import { isDesktopWorkstationHelper } from './workstationDesktopSession.js'



/** @deprecated VM workstations removed — always false */

export function sessionUsesVmWorkstation() {

  return false

}



/** @deprecated VM lab environments removed — always false */

export function sessionUsesVmLabEnvironment() {

  return false

}



/** @deprecated */

export function resolveSessionVmId() {

  return null

}



/**

 * Docker PTY jump-box terminal (not local host shell).

 * @param {object | null | undefined} session

 */

export function sessionUsesDockerTerminalWorkstation(session) {

  if (!session || sessionUsesLocalTerminalWorkstation(session)) {

    return false

  }

  const modes = session.helper?.workstationAccessModes ?? ['terminal']

  return modes.includes('terminal')

}



/**

 * User's real host shell — not sandboxed (opt-in only).

 * @param {object | null | undefined} session

 */

export function sessionUsesLocalTerminalWorkstation(session) {

  if (!session || sessionIsTargetOnlyLab(session)) return false

  if (session.helper?.workstationRuntime === 'local-terminal') return true

  if (session.selectedWorkstation?.runtime === 'local') return true

  return session.helper?.workstationProvider === 'host-local-terminal'

}



/**

 * User's real WSL distro shell — not sandboxed (Windows only, opt-in).

 * @param {object | null | undefined} session

 */

export function sessionUsesWslLocalTerminalWorkstation(session) {

  if (!session || sessionIsTargetOnlyLab(session)) return false

  if (session.helper?.workstationRuntime === 'wsl-terminal') return true

  if (session.selectedWorkstation?.runtime === 'wsl') return true

  return session.helper?.workstationProvider === 'host-wsl-terminal'

}



/**

 * Any host-side terminal (Windows local or WSL) — not Docker jump box.

 * @param {object | null | undefined} session

 */

export function sessionUsesHostTerminalWorkstation(session) {

  return sessionUsesLocalTerminalWorkstation(session) || sessionUsesWslLocalTerminalWorkstation(session)

}



/**

 * Dockur/QEMU Windows desktop in Linux Docker mode (web viewer, not integrated PTY).

 * @param {object | null | undefined} session

 */

export function sessionUsesDesktopDockerWorkstation(session) {

  if (!session || sessionIsTargetOnlyLab(session)) return false

  return isDesktopWorkstationHelper(session.helper)

}


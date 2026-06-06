/*

 * This Source Code Form is subject to the terms of the Mozilla Public

 * License, v. 2.0. If a copy of the MPL was not distributed with this

 * file, You can obtain one at https://mozilla.org/MPL/2.0/.

 */



/** Lab target is the interactive environment — no separate workstation jump box. */

export const LAB_MODE_TARGET_ONLY = 'target-only'



/** Lab target is accessed via a separate workstation jump box. */

export const LAB_MODE_TARGET_PLUS_WORKSTATION = 'target-plus-workstation'



/**

 * @param {object} [lab]

 * @returns {'target-only' | 'target-plus-workstation'}

 */

export function resolveLabMode(lab) {

  const explicit = lab?.labMode

  if (explicit === LAB_MODE_TARGET_ONLY || explicit === LAB_MODE_TARGET_PLUS_WORKSTATION) {

    return explicit

  }



  return LAB_MODE_TARGET_PLUS_WORKSTATION

}



/**

 * @param {object} [lab]

 */

export function labRequiresWorkstationSelection(lab) {

  return resolveLabMode(lab) === LAB_MODE_TARGET_PLUS_WORKSTATION

}



/**

 * @param {object} [session]

 */

export function sessionIsTargetOnlyLab(session) {

  if (!session) return false

  if (session.labMode === LAB_MODE_TARGET_ONLY) return true

  if (session.labMode === LAB_MODE_TARGET_PLUS_WORKSTATION) return false

  return false

}



/**

 * @param {object} [session]

 */

export function sessionRequiresSeparateWorkstation(session) {

  if (!session) return true

  return !sessionIsTargetOnlyLab(session)

}


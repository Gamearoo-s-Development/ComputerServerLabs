/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @deprecated Legacy label — kept for resources created before sgq.* labels */
export const LEGACY_MANAGED_LABEL = 'com.sysadmingame.managed'
/** @deprecated Legacy label */
export const LEGACY_LAB_ID_LABEL = 'com.sysadmingame.labId'
/** @deprecated Legacy label */
export const LEGACY_SESSION_ID_LABEL = 'com.sysadmingame.sessionId'

export const SGQ_MANAGED = 'sgq.managed'
export const SGQ_SESSION = 'sgq.session'
export const SGQ_LAB = 'sgq.lab'
export const SGQ_ROLE = 'sgq.role'
export const SGQ_LIFECYCLE = 'sgq.lifecycle'

export const LIFECYCLE_EPHEMERAL = 'ephemeral'
export const LIFECYCLE_PERSISTENT = 'persistent'
export const LIFECYCLE_TEMPLATE = 'template'

export const ROLE_TARGET = 'target'
export const ROLE_WORKSTATION = 'workstation'
export const ROLE_DESKTOP = 'desktop'
export const ROLE_SERVICE = 'service'

/**
 * @param {{ sessionId?: string, labId?: string, role?: string, lifecycle?: string }} params
 * @returns {Record<string, string>}
 */
export function buildSgqLabels(params = {}) {
  /** @type {Record<string, string>} */
  const labels = {
    [SGQ_MANAGED]: 'true',
    [SGQ_LIFECYCLE]: params.lifecycle ?? LIFECYCLE_EPHEMERAL
  }

  if (params.sessionId) labels[SGQ_SESSION] = params.sessionId
  if (params.labId) labels[SGQ_LAB] = params.labId
  if (params.role) labels[SGQ_ROLE] = params.role

  labels[LEGACY_MANAGED_LABEL] = 'true'
  if (params.labId) labels[LEGACY_LAB_ID_LABEL] = params.labId
  if (params.sessionId) labels[LEGACY_SESSION_ID_LABEL] = params.sessionId

  return labels
}

/**
 * @param {Record<string, string>} labels
 * @returns {string[]}
 */
export function dockerLabelArgs(labels) {
  /** @type {string[]} */
  const args = []
  for (const [key, value] of Object.entries(labels)) {
    if (value === undefined || value === null || value === '') continue
    args.push('--label', `${key}=${value}`)
  }
  return args
}

/**
 * @param {Record<string, string | undefined> | null | undefined} labels
 */
export function isSgqManagedResource(labels) {
  if (!labels) return false
  return labels[SGQ_MANAGED] === 'true' || labels[LEGACY_MANAGED_LABEL] === 'true'
}

/**
 * @param {Record<string, string | undefined> | null | undefined} labels
 */
export function resourceLifecycle(labels) {
  if (!labels) return LIFECYCLE_EPHEMERAL
  const lifecycle = labels[SGQ_LIFECYCLE]
  if (lifecycle === LIFECYCLE_PERSISTENT || lifecycle === LIFECYCLE_TEMPLATE) return lifecycle
  return LIFECYCLE_EPHEMERAL
}

/**
 * @param {Record<string, string | undefined> | null | undefined} labels
 */
export function resourceSessionId(labels) {
  if (!labels) return null
  return labels[SGQ_SESSION] ?? labels[LEGACY_SESSION_ID_LABEL] ?? null
}

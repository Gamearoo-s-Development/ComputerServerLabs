/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * @param {string | undefined} serviceRef
 * @param {object[] | undefined} routes
 */
export function serviceRefHintText(serviceRef, routes = []) {
  if (!serviceRef) return null
  const ref = String(serviceRef).toLowerCase()
  const route =
    routes.find((r) => r.id === ref) ??
    routes.find((r) => r.purpose === ref) ??
    routes.find((r) => String(r.label ?? '').toLowerCase().includes(ref))
  if (!route) return 'Use the service route listed below.'
  return `Use the ${route.label} route listed below.`
}

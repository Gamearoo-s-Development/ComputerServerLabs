/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Files in src/renderer/public/ — use BASE_URL (./ in Electron builds, / in dev).
 * Do not use import.meta.url; Vite does not resolve public/ that way.
 */
const base = import.meta.env.BASE_URL ?? './'

export const BRAND_LOGO_URL = `${base}logo.png`
export const BRAND_ICON_URL = `${base}icon.png`

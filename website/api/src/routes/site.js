/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { config } from '../config.js'

export async function siteRoutes(app) {
  app.get('/api/site/config', async () => ({
    ok: true,
    desktopDownloadUrl: config.desktopDownloadUrl,
    websiteBaseUrl: config.websiteBaseUrl
  }))
}

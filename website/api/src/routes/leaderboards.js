/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getGlobalLeaderboard, getLabLeaderboard } from '../services/leaderboard.js'

export async function leaderboardRoutes(app) {
  app.get('/api/leaderboards/global', async () => {
    return { ok: true, entries: await getGlobalLeaderboard(100) }
  })

  app.get('/api/leaderboards/lab/:labId', async (request) => {
    const entries = await getLabLeaderboard(request.params.labId, 100)
    return { ok: true, labId: request.params.labId, entries }
  })
}

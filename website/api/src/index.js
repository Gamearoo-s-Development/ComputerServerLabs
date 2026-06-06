/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { config } from './config.js'
import { initDatabase } from './db/database.js'
import { verifySmtpTransport } from './services/emailTransport.js'
import { authRoutes } from './routes/auth.js'
import { labRoutes } from './routes/labs.js'
import { progressRoutes } from './routes/progress.js'
import { notificationRoutes } from './routes/notifications.js'
import { leaderboardRoutes } from './routes/leaderboards.js'
import { adminRoutes } from './routes/admin.js'
import { siteRoutes } from './routes/site.js'

const app = Fastify({ logger: config.nodeEnv !== 'production' })

await app.register(cors, {
  origin: true,
  credentials: true
})

await app.register(rateLimit, {
  max: config.rateLimitGlobal,
  timeWindow: '1 minute'
})

await initDatabase()
console.log('[registry-api] Database ready (%s)', config.databaseUrl ? 'mariadb' : 'sqlite')

app.get('/api/health', async () => {
  const { getDb } = await import('./db/database.js')
  const row = await getDb()
    .prepare('SELECT COUNT(*) AS cnt FROM labs WHERE disabled = 0')
    .get()
  const bundledRow = await getDb()
    .prepare(`SELECT COUNT(*) AS cnt FROM labs WHERE disabled = 0 AND badges LIKE '%"bundled"%'`)
    .get()
  return {
    ok: true,
    service: 'sysadmin-game-registry',
    version: '0.1.0',
    database: config.databaseUrl ? 'mariadb' : 'sqlite',
    catalogLabCount: row?.cnt ?? 0,
    bundledLabCount: bundledRow?.cnt ?? 0
  }
})

await authRoutes(app)
await labRoutes(app)
await progressRoutes(app)
await notificationRoutes(app)
await leaderboardRoutes(app)
await adminRoutes(app)
await siteRoutes(app)

try {
  await app.listen({ port: config.port, host: config.host })
  console.log(`Registry API listening on http://${config.host}:${config.port}`)
} catch (error) {
  app.log.error(error)
  process.exit(1)
}

if (config.emailProvider === 'smtp') {
  void verifySmtpTransport().then((smtpCheck) => {
    if (smtpCheck.ok) {
      console.log('[registry-api] SMTP ready (%s:%s)', config.smtp.host, config.smtp.port)
    } else {
      console.warn(
        '[registry-api] SMTP verify failed — emails may not send:',
        smtpCheck.error ?? 'unknown error'
      )
    }
  })
}

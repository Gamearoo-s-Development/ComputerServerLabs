/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import { auditLog, getDb, nowIso, parseJson, toJson } from '../db/database.js'
import { broadcastNewVerifiedLab } from '../services/labNotifications.js'

export async function adminRoutes(app) {
  app.get('/api/admin/reports', { preHandler: authMiddleware }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return
    const reports = await getDb()
      .prepare(
        `SELECT r.*, l.title AS lab_title FROM lab_reports r
         JOIN labs l ON l.id = r.lab_id
         WHERE r.status = 'open' ORDER BY r.created_at DESC LIMIT 100`
      )
      .all()
    return { ok: true, reports }
  })

  app.post('/api/admin/labs/:id/verify', { preHandler: authMiddleware }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return
    const { verified, version } = request.body ?? {}
    const db = getDb()
    const ver = await db
      .prepare('SELECT id FROM lab_versions WHERE lab_id = ? AND version = ?')
      .get(request.params.id, version)
    if (!ver) return reply.code(404).send({ error: 'Version not found' })
    await db.prepare('UPDATE lab_versions SET verified = ? WHERE id = ?').run(verified ? 1 : 0, ver.id)
    if (verified) {
      const lab = await db.prepare('SELECT badges FROM labs WHERE id = ?').get(request.params.id)
      const badges = parseJson(lab?.badges, [])
      if (!badges.includes('verified')) {
        badges.push('verified')
        await db.prepare('UPDATE labs SET badges = ? WHERE id = ?').run(toJson(badges), request.params.id)
      }
    }
    await auditLog(request.user.id, verified ? 'lab_verified' : 'lab_unverified', 'lab', request.params.id, {
      version
    })
    if (verified) {
      void broadcastNewVerifiedLab(request.params.id, version)
    }
    return { ok: true }
  })

  app.post('/api/admin/labs/:id/disable', { preHandler: authMiddleware }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return
    await getDb().prepare('UPDATE labs SET disabled = 1, updated_at = ? WHERE id = ?').run(nowIso(), request.params.id)
    await auditLog(request.user.id, 'lab_disabled', 'lab', request.params.id, {})
    return { ok: true }
  })

  app.get('/api/admin/audit', { preHandler: authMiddleware }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return
    const logs = await getDb().prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200').all()
    return { ok: true, logs }
  })
}

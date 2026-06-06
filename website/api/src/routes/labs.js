/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import multipart from '@fastify/multipart'
import { config } from '../config.js'
import { authMiddleware, optionalAuth } from '../middleware/auth.js'
import {
  getLabById,
  getLatestLabVersion,
  listLabs,
  listLabsByCreator,
  recordDownload,
  submitLabReport
} from '../services/labRegistry.js'
import { publishLabFromPack } from '../services/labPublish.js'
import { verifyLabSignature } from '../utils/crypto.js'
import { listLabPackSourceFiles, readLabPackSourceFile } from '../services/labPackSource.js'

const MAX_PACK_BYTES = 64 * 1024 * 1024

export async function labRoutes(app) {
  await app.register(multipart, {
    limits: { fileSize: MAX_PACK_BYTES, files: 1 }
  })
  app.get('/api/labs', async (request) => {
    const { category, difficulty, runtime, badge, q } = request.query ?? {}
    return { ok: true, labs: await listLabs({ category, difficulty, runtime, badge, q }) }
  })

  app.get('/api/labs/mine', { preHandler: authMiddleware }, async (request) => {
    const labs = await listLabsByCreator(request.user.id)
    return { ok: true, labs }
  })

  app.post('/api/labs/publish', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.user.emailVerified === false) {
      return reply.code(403).send({ error: 'Verify your email before publishing labs' })
    }

    /** @type {Buffer | null} */
    let zipBuffer = null
    let changelog = ''

    for await (const part of request.parts()) {
      if (part.type === 'file' && part.fieldname === 'labPack') {
        const chunks = []
        for await (const chunk of part.file) {
          chunks.push(chunk)
        }
        zipBuffer = Buffer.concat(chunks)
      } else if (part.type === 'field' && part.fieldname === 'changelog') {
        changelog = String(part.value ?? '')
      }
    }

    if (!zipBuffer?.length) {
      return reply.code(400).send({ error: 'labPack file required (multipart field name: labPack)' })
    }
    if (zipBuffer.length > MAX_PACK_BYTES) {
      return reply.code(413).send({ error: 'Lab pack exceeds 64 MB limit' })
    }

    try {
      const result = await publishLabFromPack(request.user, zipBuffer, { changelog })
      return { ok: true, ...result }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publish failed'
      return reply.code(400).send({ error: message })
    }
  })

  app.get('/api/labs/:id', async (request, reply) => {
    const lab = await getLabById(request.params.id)
    if (!lab) return reply.code(404).send({ error: 'Lab not found' })
    return { ok: true, lab }
  })

  app.get('/api/labs/:id/checksum', async (request, reply) => {
    const version = await getLatestLabVersion(request.params.id)
    if (!version) return reply.code(404).send({ error: 'Version not found' })
    return {
      ok: true,
      labId: request.params.id,
      version: version.version,
      checksumSha256: version.checksum_sha256,
      verified: version.verified === 1
    }
  })

  app.get('/api/labs/:id/signature', async (request, reply) => {
    const version = await getLatestLabVersion(request.params.id)
    if (!version) return reply.code(404).send({ error: 'Version not found' })
    const valid = version.signature
      ? verifyLabSignature(version.checksum_sha256, version.signature)
      : null
    return {
      ok: true,
      labId: request.params.id,
      version: version.version,
      signature: version.signature,
      checksumSha256: version.checksum_sha256,
      signatureValid: valid === true,
      signingOptional: !version.signature
    }
  })

  app.get('/api/labs/:id/source', async (request, reply) => {
    const lab = await getLabById(request.params.id)
    if (!lab) return reply.code(404).send({ error: 'Lab not found' })
    try {
      const listing = await listLabPackSourceFiles(request.params.id)
      return { ok: true, ...listing }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not list lab source'
      return reply.code(404).send({ error: message })
    }
  })

  app.get('/api/labs/:id/source/file', async (request, reply) => {
    const lab = await getLabById(request.params.id)
    if (!lab) return reply.code(404).send({ error: 'Lab not found' })
    const filePath = request.query?.path
    if (!filePath) return reply.code(400).send({ error: 'path query parameter required' })
    try {
      const file = await readLabPackSourceFile(request.params.id, String(filePath))
      return { ok: true, file }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read file'
      const code = message.includes('not found') ? 404 : 400
      return reply.code(code).send({ error: message })
    }
  })

  app.get('/api/labs/:id/download', { preHandler: optionalAuth }, async (request, reply) => {
    const labId = request.params.id
    const version = await getLatestLabVersion(labId)
    if (!version) return reply.code(404).send({ error: 'Version not found' })
    const packPath = path.join(config.labPacksDir, version.pack_filename)
    if (!fs.existsSync(packPath)) {
      return reply.code(404).send({ error: 'Lab pack file missing on server' })
    }
    await recordDownload(labId, version.id, request.user?.id ?? null, request.headers['x-device-id'] ?? null)
    reply.header('Content-Type', 'application/zip')
    reply.header('Content-Disposition', `attachment; filename="${version.pack_filename}"`)
    reply.header('X-Lab-Checksum-Sha256', version.checksum_sha256)
    if (version.signature) reply.header('X-Lab-Signature', version.signature)
    return reply.send(fs.createReadStream(packPath))
  })

  app.post('/api/labs/:id/report', { preHandler: optionalAuth }, async (request, reply) => {
    const { reason, details } = request.body ?? {}
    if (!reason) return reply.code(400).send({ error: 'reason required' })
    await submitLabReport(request.params.id, request.user?.id ?? null, reason, details ?? '')
    return { ok: true }
  })
}

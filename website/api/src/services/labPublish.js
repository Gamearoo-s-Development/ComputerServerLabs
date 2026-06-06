/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { config } from '../config.js'
import { auditLog, getDb, nowIso } from '../db/database.js'
import {
  createLabRecord,
  getLatestLabVersion,
  publishLabVersion
} from './labRegistry.js'
import {
  analyzeLabPackSafety,
  normalizeRegistryCategory,
  normalizeRegistryDifficulty
} from './labPackSafety.js'
import { sha256Hex } from '../utils/crypto.js'

const MAX_PACK_BYTES = 64 * 1024 * 1024

function findZipEntry(zip, name) {
  const direct = zip.getEntry(name)
  if (direct && !direct.isDirectory) return direct
  return zip.getEntries().find((e) => !e.isDirectory && e.entryName.replace(/\\/g, '/').endsWith(`/${name}`))
}

function readZipText(zip, name) {
  const entry = findZipEntry(zip, name)
  if (!entry) return ''
  return entry.getData().toString('utf8')
}

async function nextVersion(labId) {
  const latest = await getLatestLabVersion(labId)
  if (!latest?.version) return '1.0.0'
  const parts = String(latest.version).split('.').map((n) => parseInt(n, 10) || 0)
  while (parts.length < 3) parts.push(0)
  parts[2] += 1
  return parts.join('.')
}

/**
 * Publish an uploaded lab pack zip from an authenticated Lab Builder user.
 * @param {{ id: string, display_name: string, email: string }} user
 * @param {Buffer} zipBuffer
 * @param {{ changelog?: string }} [options]
 */
export async function publishLabFromPack(user, zipBuffer, options = {}) {
  if (!zipBuffer?.length) throw new Error('Empty lab pack upload')
  if (zipBuffer.length > MAX_PACK_BYTES) throw new Error('Lab pack exceeds 64 MB limit')

  const zip = new AdmZip(zipBuffer)
  const labEntry = findZipEntry(zip, 'lab.json')
  if (!labEntry) throw new Error('lab.json missing from pack')

  let lab
  try {
    lab = JSON.parse(labEntry.getData().toString('utf8'))
  } catch {
    throw new Error('lab.json is not valid JSON')
  }

  const labId = String(lab.id ?? '').trim()
  if (!labId || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(labId)) {
    throw new Error('lab.json id must be lowercase alphanumeric with hyphens')
  }

  const safety = analyzeLabPackSafety(lab, {
    dockerfile: readZipText(zip, 'Dockerfile'),
    entrypoint: readZipText(zip, 'entrypoint.sh'),
    workstationDockerfile: readZipText(zip, 'workstation/Dockerfile'),
    validateSh: readZipText(zip, 'validate.sh')
  })
  if (safety.hasBlocked) {
    const msg = safety.issues
      .filter((i) => i.severity === 'blocked')
      .map((i) => i.message)
      .join('; ')
    throw new Error(msg || 'Lab pack failed safety review')
  }

  const db = getDb()
  const existing = await db.prepare('SELECT * FROM labs WHERE id = ?').get(labId)
  if (existing?.creator_id && existing.creator_id !== user.id) {
    throw new Error('This lab id belongs to another account')
  }
  if (existing && !existing.creator_id) {
    throw new Error('This lab id is reserved for official registry labs')
  }

  const version = await nextVersion(labId)
  const category = normalizeRegistryCategory(lab.category)
  const difficulty = normalizeRegistryDifficulty(lab.difficulty)
  const tags = Array.isArray(lab.tags) ? lab.tags : []
  const ts = nowIso()

  if (!existing) {
    await createLabRecord({
      id: labId,
      slug: labId,
      title: lab.title,
      description: lab.description ?? '',
      category,
      difficulty,
      runtime: lab.runtime ?? 'docker',
      badges: ['community', 'unverified'],
      tags,
      creatorId: user.id,
      creatorName: user.display_name,
      featured: false
    })
  } else {
    await db.prepare(
      `UPDATE labs SET title = ?, description = ?, category = ?, difficulty = ?, runtime = ?,
        creator_id = COALESCE(creator_id, ?), creator_name = COALESCE(creator_name, ?), updated_at = ?
       WHERE id = ?`
    ).run(
      lab.title,
      lab.description ?? '',
      category,
      difficulty,
      lab.runtime ?? 'docker',
      user.id,
      user.display_name,
      ts,
      labId
    )
  }

  fs.mkdirSync(config.labPacksDir, { recursive: true })
  const checksum = sha256Hex(zipBuffer)
  const filename = `${labId}-${version}.zip`
  fs.writeFileSync(path.join(config.labPacksDir, filename), zipBuffer)

  await publishLabVersion(labId, {
    version,
    changelog: options.changelog?.trim() || 'Published from Lab Builder',
    packFilename: filename,
    checksumSha256: checksum,
    signature: null,
    verified: false,
    runtimeRequirements: { docker: (lab.runtime ?? 'docker') === 'docker' }
  })

  await auditLog(user.id, 'lab_published', 'lab', labId, { version, checksum: checksum.slice(0, 12) })

  return {
    labId,
    version,
    checksumSha256: checksum,
    badges: ['community', 'unverified'],
    safetyWarnings: safety.issues.filter((i) => i.severity === 'warning')
  }
}

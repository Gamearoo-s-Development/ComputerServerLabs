/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getDb, newId, nowIso, parseJson, toJson } from '../db/database.js'
import { reviewUpsertSql } from '../db/dialect.js'
import { broadcastLabUpdate } from './labNotifications.js'

function isBundledLabRow(row) {
  if (!row) return false
  const badges = parseJson(row.badges, [])
  return badges.includes('bundled')
}

function mapLabRow(row, latestVersion = null) {
  if (!row) return null
  const bundled = isBundledLabRow(row)
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    difficulty: row.difficulty,
    runtime: row.runtime,
    badges: parseJson(row.badges, []),
    isBundled: bundled,
    tags: parseJson(row.tags, []),
    creatorName: row.creator_name,
    featured: row.featured === 1,
    disabled: row.disabled === 1,
    avgRating: row.avg_rating,
    ratingCount: row.rating_count,
    downloadCount: row.download_count,
    latestVersion: latestVersion
      ? {
          version: latestVersion.version,
          changelog: latestVersion.changelog,
          checksumSha256: latestVersion.checksum_sha256,
          verified: latestVersion.verified === 1,
          runtimeRequirements: parseJson(latestVersion.runtime_requirements, {}),
          publishedAt: latestVersion.published_at
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function listLabs(filters = {}) {
  const db = getDb()
  const clauses = ['disabled = 0']
  /** @type {unknown[]} */
  const params = []

  if (filters.category) {
    clauses.push('category = ?')
    params.push(filters.category)
  }
  if (filters.difficulty) {
    clauses.push('difficulty = ?')
    params.push(filters.difficulty)
  }
  if (filters.runtime) {
    clauses.push('runtime = ?')
    params.push(filters.runtime)
  }
  if (filters.badge === 'bundled') {
    clauses.push('badges LIKE ?')
    params.push('%"bundled"%')
  } else if (filters.badge) {
    clauses.push('badges LIKE ?')
    params.push(`%"${filters.badge}"%`)
  }
  if (filters.q) {
    clauses.push('(title LIKE ? OR description LIKE ? OR tags LIKE ?)')
    const like = `%${filters.q}%`
    params.push(like, like, like)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await db
    .prepare(`SELECT * FROM labs ${where} ORDER BY featured DESC, updated_at DESC LIMIT 500`)
    .all(...params)

  const results = []
  for (const row of rows) {
    const latest = await db
      .prepare(`SELECT * FROM lab_versions WHERE lab_id = ? ORDER BY published_at DESC LIMIT 1`)
      .get(row.id)
    results.push(mapLabRow(row, latest))
  }
  return results
}

export async function listLabsByCreator(creatorId) {
  const db = getDb()
  const rows = await db
    .prepare('SELECT * FROM labs WHERE creator_id = ? AND disabled = 0 ORDER BY updated_at DESC LIMIT 100')
    .all(creatorId)

  const results = []
  for (const row of rows) {
    const latest = await db
      .prepare(`SELECT * FROM lab_versions WHERE lab_id = ? ORDER BY published_at DESC LIMIT 1`)
      .get(row.id)
    results.push(mapLabRow(row, latest))
  }
  return results
}

export async function getLabById(labId) {
  const db = getDb()
  const row = await db.prepare('SELECT * FROM labs WHERE id = ? AND disabled = 0').get(labId)
  if (!row) return null
  const latest = await db
    .prepare(`SELECT * FROM lab_versions WHERE lab_id = ? ORDER BY published_at DESC LIMIT 1`)
    .get(labId)
  const versions = await db
    .prepare(
      `SELECT id, version, changelog, checksum_sha256, verified, published_at FROM lab_versions WHERE lab_id = ? ORDER BY published_at DESC`
    )
    .all(labId)
  const reviews = await db
    .prepare(
      `SELECT r.rating, r.body, r.created_at, u.display_name
       FROM lab_reviews r JOIN users u ON u.id = r.user_id
       WHERE r.lab_id = ? ORDER BY r.created_at DESC LIMIT 20`
    )
    .all(labId)
  return {
    ...mapLabRow(row, latest),
    versions,
    reviews
  }
}

export async function getLatestLabVersion(labId) {
  return getDb()
    .prepare(`SELECT * FROM lab_versions WHERE lab_id = ? ORDER BY published_at DESC LIMIT 1`)
    .get(labId)
}

export async function recordDownload(labId, versionId, userId, deviceId) {
  const db = getDb()
  await db
    .prepare(
      `INSERT INTO lab_downloads (id, lab_id, version_id, user_id, device_id, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(newId('dl'), labId, versionId, userId ?? null, deviceId ?? null, nowIso())
  await db.prepare('UPDATE labs SET download_count = download_count + 1 WHERE id = ?').run(labId)
}

export async function submitLabReport(labId, userId, reason, details) {
  await getDb()
    .prepare(
      `INSERT INTO lab_reports (id, lab_id, user_id, reason, details, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`
    )
    .run(newId('report'), labId, userId ?? null, reason, details ?? '', nowIso())
}

export async function upsertLabReview(labId, userId, rating, body) {
  const db = getDb()
  await db
    .prepare(reviewUpsertSql())
    .run(newId('review'), labId, userId, rating, body ?? '', nowIso())

  const agg = await db.prepare('SELECT AVG(rating) AS avg, COUNT(*) AS cnt FROM lab_reviews WHERE lab_id = ?').get(labId)
  await db.prepare('UPDATE labs SET avg_rating = ?, rating_count = ? WHERE id = ?').run(agg.avg ?? 0, agg.cnt ?? 0, labId)
}

export async function createLabRecord(data) {
  const db = getDb()
  const id = data.id ?? newId('lab')
  const ts = nowIso()
  await db
    .prepare(
      `INSERT INTO labs (id, slug, title, description, category, difficulty, runtime, badges, tags,
      creator_id, creator_name, featured, disabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      id,
      data.slug,
      data.title,
      data.description ?? '',
      data.category ?? 'general',
      data.difficulty ?? 'beginner',
      data.runtime ?? 'docker',
      toJson(data.badges ?? ['community']),
      toJson(data.tags ?? []),
      data.creatorId ?? null,
      data.creatorName ?? 'Community',
      data.featured ? 1 : 0,
      ts,
      ts
    )
  return id
}

export async function publishLabVersion(labId, versionData) {
  const db = getDb()
  const prior = await db.prepare('SELECT COUNT(*) AS cnt FROM lab_versions WHERE lab_id = ?').get(labId)
  const id = newId('ver')
  await db
    .prepare(
      `INSERT INTO lab_versions (id, lab_id, version, changelog, pack_filename, checksum_sha256,
      signature, verified, runtime_requirements, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      labId,
      versionData.version,
      versionData.changelog ?? '',
      versionData.packFilename,
      versionData.checksumSha256,
      versionData.signature ?? null,
      versionData.verified ? 1 : 0,
      toJson(versionData.runtimeRequirements ?? {}),
      nowIso()
    )
  await db.prepare('UPDATE labs SET updated_at = ? WHERE id = ?').run(nowIso(), labId)
  if ((prior?.cnt ?? 0) > 0) {
    void broadcastLabUpdate(labId, versionData.version)
  }
  return id
}

export { mapLabRow }

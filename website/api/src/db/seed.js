/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from '../config.js'
import { getDb, initDatabase, closeDatabase, nowIso, toJson, parseJson } from './database.js'
import {
  createLabRecord,
  getLatestLabVersion,
  publishLabVersion
} from '../services/labRegistry.js'
import { normalizeRegistryCategory, normalizeRegistryDifficulty } from '../services/labPackSafety.js'
import { sha256Hex, signLabChecksum } from '../utils/crypto.js'
import { sortLabsByUnlockOrder } from '../../../../shared/lab-format/labUnlockSort.js'
import { isRegistryPackComplete, packLabForRegistry } from '../services/labPackBuild.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const REPO_ROOT = process.env.REPO_ROOT
  ? path.resolve(process.env.REPO_ROOT)
  : resolveDefaultRepoRoot()

const CATALOG_LABS_ROOT = process.env.CATALOG_LABS_DIR
  ? path.resolve(process.env.CATALOG_LABS_DIR)
  : path.resolve(__dirname, '../../../catalog-labs')

const BUNDLED_BADGES = ['bundled', 'official', 'verified', 'docker-only']
const CATALOG_ONLY_BADGES = ['official', 'verified', 'catalog-only']

const SKIP_DIRS = new Set(['_shared', 'common', '.gitkeep', 'bundled', 'community'])

function getSharedLabsRoot() {
  return path.join(REPO_ROOT, 'labs')
}

/**
 * @param {string} labJsonPath
 * @param {string} labsContentRoot
 * @param {{ badges: string[], featuredIds?: string[] }} options
 */
function labMetaFromFile(labJsonPath, labsContentRoot, options) {
  let labJson
  try {
    labJson = JSON.parse(fs.readFileSync(labJsonPath, 'utf8'))
  } catch {
    console.warn('[seed] Invalid lab.json', labJsonPath)
    return null
  }

  const folder = path.basename(path.dirname(labJsonPath))
  const id = labJson.id || folder
  const featuredIds = options.featuredIds ?? []
  const labDir = path.dirname(labJsonPath)
  const hasDockerfile = fs.existsSync(path.join(labDir, 'Dockerfile'))

  return {
    id,
    slug: id,
    title: labJson.title || id,
    description: labJson.description || '',
    category: normalizeRegistryCategory(labJson.category),
    difficulty: normalizeRegistryDifficulty(labJson.difficulty),
    runtime: labJson.runtime ?? 'docker',
    badges: [...options.badges],
    tags: Array.isArray(labJson.tags) ? labJson.tags : [],
    featured: featuredIds.includes(id),
    unlockRequirements: labJson.unlockRequirements ?? { minLevel: 1 },
    labsContentRoot,
    hasDockerfile
  }
}

/**
 * @param {string} labsDir
 * @param {{ badges: string[], featuredIds?: string[] }} options
 */
function discoverLabsInDirectory(labsDir, options) {
  if (!fs.existsSync(labsDir)) return []

  /** @type {object[]} */
  const discovered = []
  for (const entry of fs.readdirSync(labsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name) || entry.name.startsWith('_')) continue
    const labJsonPath = path.join(labsDir, entry.name, 'lab.json')
    if (!fs.existsSync(labJsonPath)) continue
    const meta = labMetaFromFile(labJsonPath, labsDir, options)
    if (meta) discovered.push(meta)
  }
  return discovered
}

/**
 * Discover labs under nested track folders (e.g. bundled tracks and community examples).
 * @param {string} parentDir
 * @param {{ badges: string[], featuredIds?: string[] }} options
 */
function discoverNestedTrackLabs(parentDir, options) {
  if (!fs.existsSync(parentDir)) return []

  /** @type {object[]} */
  const discovered = []
  for (const trackEntry of fs.readdirSync(parentDir, { withFileTypes: true })) {
    if (!trackEntry.isDirectory() || trackEntry.name.startsWith('_') || trackEntry.name.startsWith('.')) {
      continue
    }
    if (trackEntry.name === 'template') continue
    const trackPath = path.join(parentDir, trackEntry.name)
    discovered.push(...discoverLabsInDirectory(trackPath, options))
  }
  return discovered
}

/** @param {object[]} labs */
function dedupeLabsById(labs) {
  /** @type {Map<string, object>} */
  const byId = new Map()
  for (const meta of labs) {
    if (!byId.has(meta.id)) byId.set(meta.id, meta)
  }
  return sortLabsByUnlockOrder([...byId.values()])
}

/** Discover every folder under app/labs that contains lab.json. */
export function discoverBundledLabs(repoRoot = REPO_ROOT) {
  const labsRoot = path.join(repoRoot, 'labs')
  const flat = discoverLabsInDirectory(labsRoot, {
    badges: BUNDLED_BADGES,
    featuredIds: ['beginner-linux-001', 'nginx-001']
  })
  const nested = discoverNestedTrackLabs(path.join(labsRoot, 'bundled'), {
    badges: BUNDLED_BADGES,
    featuredIds: ['beginner-linux-001', 'nginx-001']
  })
  return dedupeLabsById([...flat, ...nested])
}

/** Community example labs (advanced / experimental). */
export function discoverCommunityExampleLabs(repoRoot = REPO_ROOT) {
  return discoverNestedTrackLabs(path.join(repoRoot, 'labs', 'community', 'examples'), {
    badges: ['community', 'catalog-only', 'docker-only'],
    featuredIds: []
  })
}

function resolveDefaultRepoRoot() {
  const candidates = [
    path.resolve(__dirname, '../../../../app'),
    path.resolve(__dirname, '../../../..'),
    path.resolve(__dirname, '../../..')
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'labs'))) {
      return candidate
    }
  }
  return candidates[0]
}

/** Labs shipped on the registry but not in the desktop app bundle. */
export function discoverCatalogOnlyLabs(catalogRoot = CATALOG_LABS_ROOT) {
  return discoverLabsInDirectory(catalogRoot, {
    badges: CATALOG_ONLY_BADGES,
    featuredIds: ['catalog-ufw-basics-001']
  })
}

/**
 * @param {string} labId
 * @param {string} labsDir
 * @param {string} version
 */
async function writeOfficialPackFile(labId, labsDir, version) {
  const labPath = path.join(labsDir, labId)
  if (!fs.existsSync(path.join(labPath, 'lab.json'))) {
    throw new Error(`Missing lab folder for ${labId}`)
  }
  const sharedLabsRoot = getSharedLabsRoot()
  const packBuffer = packLabForRegistry({
    labsContentRoot: labsDir,
    labId,
    version,
    sharedLabsRoot
  })
  const checksum = sha256Hex(packBuffer)
  const signature = signLabChecksum(checksum)
  const filename = `${labId}-${version}.zip`
  fs.mkdirSync(config.labPacksDir, { recursive: true })
  fs.writeFileSync(path.join(config.labPacksDir, filename), packBuffer)
  return { version, filename, checksum, signature }
}

/**
 * Rewrite pack on disk and sync checksum/signature on the matching lab_versions row.
 * @param {string} labId
 * @param {string} labsDir
 * @param {string} version
 */
async function refreshOfficialPackOnDisk(labId, labsDir, version) {
  const pack = await writeOfficialPackFile(labId, labsDir, version)
  await getDb()
    .prepare(
      `UPDATE lab_versions SET pack_filename = ?, checksum_sha256 = ?, signature = ?, verified = ?
       WHERE lab_id = ? AND version = ?`
    )
    .run(
      pack.filename,
      pack.checksum,
      pack.signature,
      pack.signature ? 1 : 0,
      labId,
      version
    )
  return pack
}

/**
 * Fix checksum rows when pack files were rewritten without updating the database.
 */
export async function repairLabPackChecksums() {
  const db = getDb()
  const rows = await db
    .prepare('SELECT lab_id, version, pack_filename, checksum_sha256 FROM lab_versions')
    .all()
  let fixed = 0
  for (const row of rows) {
    if (!row.pack_filename) continue
    const packPath = path.join(config.labPacksDir, row.pack_filename)
    if (!fs.existsSync(packPath)) continue
    const actual = sha256Hex(fs.readFileSync(packPath))
    if (actual === row.checksum_sha256) continue
    const signature = signLabChecksum(actual)
    await db
      .prepare(
        `UPDATE lab_versions SET checksum_sha256 = ?, signature = ?, verified = ? WHERE lab_id = ? AND version = ?`
      )
      .run(actual, signature, signature ? 1 : 0, row.lab_id, row.version)
    fixed += 1
    console.log('[seed] Repaired checksum for', row.lab_id, row.version)
  }
  if (fixed > 0) {
    console.log('[seed] Checksum repair complete — fixed:', fixed)
  }
}

/**
 * @param {string} labId
 * @param {object} meta
 * @param {string} labsDir
 * @param {string} changelog
 * @param {string} [version]
 */
async function publishOfficialPack(labId, meta, labsDir, changelog, version = '1.0.0') {
  const pack = await writeOfficialPackFile(labId, labsDir, version)
  await publishLabVersion(labId, {
    version: pack.version,
    changelog,
    packFilename: pack.filename,
    checksumSha256: pack.checksum,
    signature: pack.signature,
    verified: Boolean(pack.signature),
    runtimeRequirements: { docker: (meta.runtime ?? 'docker') === 'docker' }
  })
  return pack
}

/**
 * @param {object} meta
 * @param {string} labsDir
 * @param {{ changelog: string, logLabel: string, skipIfBadges?: string[] }} options
 * @returns {Promise<'added' | 'synced' | 'repackaged' | 'skipped'>}
 */
async function syncOfficialLab(meta, labsDir, options) {
  const db = getDb()
  const existing = await db.prepare('SELECT * FROM labs WHERE id = ?').get(meta.id)
  const ts = nowIso()

  if (existing?.creator_id) {
    return 'skipped'
  }

  if (existing && options.skipIfBadges?.length) {
    const badges = parseJson(existing.badges, [])
    if (options.skipIfBadges.some((b) => badges.includes(b))) {
      return 'skipped'
    }
  }

  if (!existing) {
    await createLabRecord({
      id: meta.id,
      slug: meta.slug,
      title: meta.title,
      description: meta.description,
      category: meta.category,
      difficulty: meta.difficulty,
      runtime: meta.runtime,
      badges: meta.badges,
      tags: meta.tags,
      creatorName: 'Computer Server Labs',
      featured: meta.featured
    })
    if (meta.hasDockerfile !== false) {
      await publishOfficialPack(meta.id, meta, labsDir, options.changelog, '1.0.0')
    }
    console.log(`[seed] Added ${options.logLabel}`, meta.id)
    return 'added'
  }

  await db
    .prepare(
      `UPDATE labs SET title = ?, description = ?, category = ?, difficulty = ?, runtime = ?,
        badges = ?, tags = ?, featured = ?, disabled = 0, updated_at = ?
       WHERE id = ?`
    )
    .run(
      meta.title,
      meta.description,
      meta.category,
      meta.difficulty,
      meta.runtime,
      toJson(meta.badges),
      toJson(meta.tags),
      meta.featured ? 1 : 0,
      ts,
      meta.id
    )

  const latest = await getLatestLabVersion(meta.id)
  const packPath = latest?.pack_filename
    ? path.join(config.labPacksDir, latest.pack_filename)
    : null

  if (!latest) {
    if (meta.hasDockerfile === false) {
      return 'synced'
    }
    await publishOfficialPack(meta.id, meta, labsDir, options.changelog, '1.0.0')
    console.log('[seed] Published missing version for', meta.id)
    return 'repackaged'
  }

  if (meta.hasDockerfile === false) {
    return 'synced'
  }

  if (!packPath || !fs.existsSync(packPath)) {
    await refreshOfficialPackOnDisk(meta.id, labsDir, latest.version)
    console.log('[seed] Restored pack file for', meta.id, latest.version)
    return 'repackaged'
  }

  const sharedLabsRoot = getSharedLabsRoot()
  if (!isRegistryPackComplete(packPath, meta.id, labsDir, sharedLabsRoot)) {
    await refreshOfficialPackOnDisk(meta.id, labsDir, latest.version)
    console.log('[seed] Repackaged incomplete docker context for', meta.id, latest.version)
    return 'repackaged'
  }

  return 'synced'
}

/** @param {object} meta */
export async function syncBundledLab(meta) {
  const labsDir = meta.labsContentRoot ?? path.join(REPO_ROOT, 'labs')
  return syncOfficialLab(meta, labsDir, {
    changelog: 'Bundled with Computer Server Labs',
    logLabel: 'bundled lab',
    skipIfBadges: ['catalog-only']
  })
}

/** @param {object} meta */
export async function syncCatalogOnlyLab(meta) {
  const labsDir = meta.labsContentRoot ?? CATALOG_LABS_ROOT
  return syncOfficialLab(meta, labsDir, {
    changelog: 'Catalog download — not bundled with the desktop app',
    logLabel: 'catalog-only lab',
    skipIfBadges: ['bundled']
  })
}

/** @param {object} meta */
export async function syncCommunityExampleLab(meta) {
  const labsDir = meta.labsContentRoot ?? path.join(REPO_ROOT, 'labs', 'community', 'examples')
  return syncOfficialLab(meta, labsDir, {
    changelog: 'Community example lab — experimental content',
    logLabel: 'community example',
    skipIfBadges: ['bundled']
  })
}

export async function seedRegistry() {
  await initDatabase()
  fs.mkdirSync(config.labPacksDir, { recursive: true })

  const stats = { added: 0, synced: 0, repackaged: 0, skipped: 0 }

  const bundledLabs = discoverBundledLabs(REPO_ROOT)
  console.log('[seed] Discovered', bundledLabs.length, 'bundled lab(s) in', path.join(REPO_ROOT, 'labs'))

  for (const meta of bundledLabs) {
    try {
      const result = await syncBundledLab(meta)
      stats[result] += 1
    } catch (err) {
      console.warn('[seed] Failed to sync bundled', meta.id, err instanceof Error ? err.message : err)
    }
  }

  const catalogLabs = discoverCatalogOnlyLabs(CATALOG_LABS_ROOT)
  console.log('[seed] Discovered', catalogLabs.length, 'catalog-only lab(s) in', CATALOG_LABS_ROOT)

  for (const meta of catalogLabs) {
    try {
      const result = await syncCatalogOnlyLab(meta)
      stats[result] += 1
    } catch (err) {
      console.warn('[seed] Failed to sync catalog', meta.id, err instanceof Error ? err.message : err)
    }
  }

  const communityLabs = discoverCommunityExampleLabs(REPO_ROOT)
  console.log('[seed] Discovered', communityLabs.length, 'community example lab(s)')

  for (const meta of communityLabs) {
    try {
      const result = await syncCommunityExampleLab(meta)
      stats[result] += 1
    } catch (err) {
      console.warn('[seed] Failed to sync community', meta.id, err instanceof Error ? err.message : err)
    }
  }

  const dbCount = await getDb().prepare('SELECT COUNT(*) AS cnt FROM labs WHERE disabled = 0').get()
  const bundledCount = await getDb()
    .prepare(`SELECT COUNT(*) AS cnt FROM labs WHERE disabled = 0 AND badges LIKE '%"bundled"%'`)
    .get()
  console.log(
    '[seed] Sync complete — added:',
    stats.added,
    'synced:',
    stats.synced,
    'repackaged:',
    stats.repackaged,
    'skipped:',
    stats.skipped,
    '| catalog:',
    dbCount?.cnt ?? 0,
    'bundled:',
    bundledCount?.cnt ?? 0
  )

  await repairLabPackChecksums()
  await closeDatabase()
}

if (import.meta.url.endsWith('seed.js') || process.argv[1]?.endsWith('seed.js')) {
  seedRegistry()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] Failed', err)
      process.exit(1)
    })
}

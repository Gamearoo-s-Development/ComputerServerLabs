/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { config } from '../config.js'
import { getLatestLabVersion } from './labRegistry.js'

const MAX_LIST_FILES = 500
const MAX_VIEW_BYTES = 512 * 1024

const TEXT_EXTENSIONS = new Set([
  '.json',
  '.md',
  '.txt',
  '.sh',
  '.bash',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.yml',
  '.yaml',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
  '.xml',
  '.html',
  '.htm',
  '.css',
  '.sql',
  '.env',
  '.properties',
  '.dockerignore',
  '.gitignore',
  '.gitattributes'
])

const TEXT_BASENAMES = new Set([
  'dockerfile',
  'makefile',
  'license',
  'readme',
  'entrypoint',
  'lab-setup',
  'validate',
  'manifest.json'
])

const BINARY_EXTENSIONS = new Set([
  '.zip',
  '.gz',
  '.tar',
  '.tgz',
  '.bz2',
  '.xz',
  '.7z',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.wasm',
  '.bin',
  '.dat',
  '.db',
  '.sqlite'
])

/**
 * @param {string} raw
 */
export function normalizePackEntryPath(raw) {
  const normalized = String(raw ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim()
  if (!normalized || normalized.includes('..') || normalized.includes('\0')) {
    throw new Error('Invalid file path')
  }
  return normalized
}

/**
 * @param {string} entryPath
 */
function isLikelyTextFile(entryPath) {
  const base = path.posix.basename(entryPath)
  const lower = base.toLowerCase()
  const ext = path.posix.extname(lower)
  if (BINARY_EXTENSIONS.has(ext)) return false
  if (TEXT_EXTENSIONS.has(ext)) return true
  if (TEXT_BASENAMES.has(lower)) return true
  if (lower.startsWith('dockerfile')) return true
  if (lower.endsWith('.example')) return true
  return false
}

/**
 * @param {Buffer} buf
 */
function bufferLooksBinary(buf) {
  const sample = buf.subarray(0, Math.min(buf.length, 8192))
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true
  }
  return false
}

/**
 * @param {string} labId
 */
async function openLabPackZip(labId) {
  const version = await getLatestLabVersion(labId)
  if (!version) throw new Error('Version not found')
  const packPath = path.join(config.labPacksDir, version.pack_filename)
  if (!fs.existsSync(packPath)) throw new Error('Lab pack file missing on server')
  return {
    version: version.version,
    zip: new AdmZip(packPath)
  }
}

/**
 * @param {AdmZip} zip
 * @param {string} entryPath
 */
function getZipEntry(zip, entryPath) {
  const entry =
    zip.getEntry(entryPath) ??
    zip.getEntry(`${entryPath}/`) ??
    zip
      .getEntries()
      .find((e) => !e.isDirectory && e.entryName.replace(/\\/g, '/') === entryPath)
  if (!entry || entry.isDirectory) throw new Error('File not found in lab pack')
  return entry
}

/**
 * @param {string} labId
 */
export async function listLabPackSourceFiles(labId) {
  const { version, zip } = await openLabPackZip(labId)
  const entries = zip
    .getEntries()
    .filter((e) => !e.isDirectory)
    .map((e) => e.entryName.replace(/\\/g, '/'))
    .sort((a, b) => a.localeCompare(b))

  const files = []
  for (const entryPath of entries.slice(0, MAX_LIST_FILES)) {
    const entry = zip.getEntry(entryPath)
    if (!entry) continue
    const size = entry.header?.size ?? entry.getData().length
    const viewable = isLikelyTextFile(entryPath) && size <= MAX_VIEW_BYTES
    files.push({
      path: entryPath,
      size,
      viewable
    })
  }

  return {
    labId,
    version,
    truncated: entries.length > MAX_LIST_FILES,
    totalFiles: entries.length,
    files
  }
}

/**
 * @param {string} labId
 * @param {string} filePath
 */
export async function readLabPackSourceFile(labId, filePath) {
  const safePath = normalizePackEntryPath(filePath)
  const { version, zip } = await openLabPackZip(labId)
  const entry = getZipEntry(zip, safePath)
  const size = entry.header?.size ?? 0
  if (size > MAX_VIEW_BYTES) {
    throw new Error('File too large to view in browser')
  }
  const data = entry.getData()
  if (!isLikelyTextFile(safePath) && bufferLooksBinary(data)) {
    throw new Error('Binary files cannot be viewed in the browser')
  }
  if (bufferLooksBinary(data)) {
    throw new Error('Binary files cannot be viewed in the browser')
  }

  return {
    labId,
    version,
    path: safePath,
    size: data.length,
    encoding: 'utf-8',
    content: data.toString('utf8')
  }
}

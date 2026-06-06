/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'

const FORBIDDEN_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.exe',
  '.bat',
  '.cmd',
  '.ps1',
  '.vbs',
  '.dll',
  '.so',
  '.dylib'
])

const FORBIDDEN_NAMES = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.env',
  '.env.local'
])

export const MAX_LAB_FOLDER_SCAN_DEPTH = 6
export const MAX_ZIP_EXTRACT_BYTES = 50 * 1024 * 1024
export const MAX_ZIP_ENTRIES = 500

/**
 * @param {string} baseDir
 * @param {string} targetPath
 */
export function resolvePathWithin(baseDir, targetPath) {
  const base = path.resolve(baseDir)
  const resolved = path.resolve(base, targetPath)
  const relative = path.relative(base, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes allowed directory')
  }
  return resolved
}

/**
 * @param {string} dir
 * @param {{ maxDepth?: number }} [options]
 */
export function scanDirectoryForUnsafeContent(dir, options = {}) {
  const maxDepth = options.maxDepth ?? MAX_LAB_FOLDER_SCAN_DEPTH
  /** @type {string[]} */
  const issues = []

  function walk(current, depth) {
    if (depth > maxDepth) return
    let entries = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      issues.push(`Cannot read directory: ${current}`)
      return
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name)
      const lower = entry.name.toLowerCase()

      if (entry.isSymbolicLink()) {
        issues.push(`Symlinks are not allowed: ${full}`)
        continue
      }

      if (FORBIDDEN_NAMES.has(lower)) {
        issues.push(`Forbidden file name: ${entry.name}`)
      }

      const ext = path.extname(lower)
      if (ext && FORBIDDEN_EXTENSIONS.has(ext)) {
        issues.push(`Forbidden file type: ${entry.name}`)
      }

      if (entry.isDirectory()) {
        walk(full, depth + 1)
      }
    }
  }

  walk(path.resolve(dir), 0)
  return issues
}

/**
 * @param {string} sourceDir
 * @param {string} destDir
 */
export function assertSafeLabImportPath(sourceDir, destDir) {
  const source = path.resolve(sourceDir)
  const dest = path.resolve(destDir)
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error('Import source must be an existing folder')
  }
  if (!fs.existsSync(path.join(source, 'lab.json'))) {
    throw new Error('Imported folder must contain lab.json')
  }
  const issues = scanDirectoryForUnsafeContent(source)
  if (issues.length > 0) {
    throw new Error(`Unsafe lab content: ${issues[0]}`)
  }
  resolvePathWithin(path.dirname(dest), path.basename(dest))
}

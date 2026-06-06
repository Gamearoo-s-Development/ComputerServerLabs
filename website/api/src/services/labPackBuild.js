/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { nowIso } from '../db/database.js'

const SKIP_DIR_NAMES = new Set(['_shared', '.git', 'node_modules'])

/**
 * @param {AdmZip} zip
 * @param {string} dirAbs
 * @param {string} zipPath
 */
function addDirectoryToZip(zip, dirAbs, zipPath) {
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIR_NAMES.has(entry.name)) continue
    const full = path.join(dirAbs, entry.name)
    const rel = zipPath ? `${zipPath}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, full, rel)
    } else {
      zip.addLocalFile(full, zipPath || undefined, entry.name)
    }
  }
}

/**
 * @param {string} labsContentRoot - directory containing lab id folders (e.g. app/labs or catalog-labs)
 * @param {string} labId
 * @param {string} [sharedLabsRoot] - app/labs root for common/ when buildPath is ".."
 */
function readLabJson(labsContentRoot, labId) {
  const labJsonPath = path.join(labsContentRoot, labId, 'lab.json')
  if (!fs.existsSync(labJsonPath)) {
    throw new Error(`Missing lab.json for ${labId}`)
  }
  return JSON.parse(fs.readFileSync(labJsonPath, 'utf8'))
}

/**
 * Build a registry lab pack zip matching desktop docker build layout.
 * @param {{ labsContentRoot: string, labId: string, version: string, sharedLabsRoot?: string }} options
 */
export function packLabForRegistry(options) {
  const { labsContentRoot, labId, version, sharedLabsRoot = labsContentRoot } = options
  const labDir = path.join(labsContentRoot, labId)
  const labJson = readLabJson(labsContentRoot, labId)
  const buildPathRel = labJson.docker?.buildPath ?? '.'

  const zip = new AdmZip()

  if (buildPathRel === '..') {
    const commonDir = path.join(sharedLabsRoot, 'common')
    if (!fs.existsSync(commonDir)) {
      throw new Error(`Lab ${labId} requires shared common/ scripts (buildPath "..") but common/ was not found`)
    }
    addDirectoryToZip(zip, commonDir, 'common')
    addDirectoryToZip(zip, labDir, labId)

    const labsRootExtras = ['sgq-entrypoint.sh']
    for (const name of labsRootExtras) {
      const extraPath = path.join(sharedLabsRoot, name)
      if (fs.existsSync(extraPath) && fs.statSync(extraPath).isFile()) {
        zip.addLocalFile(extraPath, '', name)
      }
    }
  } else if (buildPathRel === '.') {
    addDirectoryToZip(zip, labDir, labId)
  } else {
    const contextDir = path.resolve(labDir, buildPathRel)
    if (!fs.existsSync(contextDir)) {
      throw new Error(`Build path not found for ${labId}: ${buildPathRel}`)
    }
    const prefix = `${labId}/${buildPathRel.replace(/\\/g, '/').replace(/^\.\//, '')}`
    addDirectoryToZip(zip, contextDir, prefix)
  }

  const manifest = {
    labId,
    version,
    packedAt: nowIso(),
    packLayout: buildPathRel === '..' ? 'labs-root' : 'lab-folder',
    buildPath: buildPathRel,
    files: zip.getEntries().map((e) => e.entryName)
  }
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'))
  return zip.toBuffer()
}

/**
 * @param {string} packPath
 * @param {string} labId
 * @param {string} labsContentRoot
 * @param {string} [sharedLabsRoot]
 */
export function isRegistryPackComplete(packPath, labId, labsContentRoot, sharedLabsRoot = labsContentRoot) {
  if (!fs.existsSync(packPath)) return false
  let labJson
  try {
    labJson = readLabJson(labsContentRoot, labId)
  } catch {
    return false
  }

  const buildPathRel = labJson.docker?.buildPath ?? '.'
  const zip = new AdmZip(packPath)
  const entries = zip
    .getEntries()
    .filter((e) => !e.isDirectory)
    .map((e) => e.entryName.replace(/\\/g, '/'))

  const needsDocker = (labJson.runtime ?? 'docker') === 'docker'
  const hasDockerfile = entries.some((n) => n === `${labId}/Dockerfile` || n === 'Dockerfile')
  const hasLabJson = entries.some((n) => n === `${labId}/lab.json` || n === 'lab.json')

  if (buildPathRel === '..') {
    const hasCommon = entries.some((n) => n.startsWith('common/'))
    if (!hasCommon || !hasLabJson) return false
    if (needsDocker && !hasDockerfile) return false
    return true
  }

  if (buildPathRel === '.') {
    if (!hasLabJson) return false
    if (needsDocker && !hasDockerfile) return false
    return true
  }

  return entries.length > 0
}

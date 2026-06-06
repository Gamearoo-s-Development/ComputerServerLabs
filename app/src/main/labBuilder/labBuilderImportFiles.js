/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { syncFilesystemFields } from './labFilesystem.js'
import { inferFileStage } from './labTemplateVariables.js'

/**
 * @param {string} draftRoot
 * @param {string} sourcePath
 * @param {string} relDest under files/
 */
function copyIntoDraftFiles(draftRoot, sourcePath, relDest) {
  const dest = path.join(draftRoot, 'files', relDest)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const stat = fs.statSync(sourcePath)
  if (stat.isDirectory()) {
    fs.cpSync(sourcePath, dest, { recursive: true })
  } else {
    fs.copyFileSync(sourcePath, dest)
  }
}

/**
 * @param {object} lab
 * @param {{
 *   scope: 'target' | 'workstation'
 *   destPath: string
 *   sourcePath: string
 *   owner?: string
 *   group?: string
 *   mode?: string
 *   stage?: string
 *   renderVariables?: boolean
 *   isDirectory?: boolean
 * }} item
 */
export function addImportToLabFilesystem(lab, item) {
  const scope = item.scope === 'workstation' ? 'workstation' : 'target'
  const destPath = String(item.destPath ?? '').trim()
  if (!destPath.startsWith('/')) {
    throw new Error('Destination path must be absolute (start with /)')
  }

  syncFilesystemFields(lab)
  if (!lab.filesystem) {
    lab.filesystem = { target: { files: [], directories: [], symlinks: [] }, workstation: { files: [], directories: [], symlinks: [] } }
  }
  const bucket = lab.filesystem[scope]
  if (!bucket) {
    lab.filesystem[scope] = { files: [], directories: [], symlinks: [] }
  }

  const stage =
    item.stage === 'build' || item.stage === 'runtime'
      ? item.stage
      : inferFileStage({ path: destPath, content: '' })

  if (item.isDirectory) {
    bucket.directories = bucket.directories ?? []
    bucket.directories.push({
      path: destPath,
      owner: item.owner ?? '{{LOGIN_USER}}',
      group: item.group ?? '{{LOGIN_USER}}',
      mode: item.mode ?? '0755',
      stage
    })
    return
  }

  let content = ''
  try {
    content = fs.readFileSync(item.sourcePath, 'utf8')
  } catch {
    content = ''
  }

  bucket.files = bucket.files ?? []
  bucket.files.push({
    path: destPath,
    content,
    owner: item.owner ?? (scope === 'workstation' ? '{{USERNAME}}' : '{{LOGIN_USER}}'),
    group: item.group ?? (scope === 'workstation' ? '{{USERNAME}}' : '{{LOGIN_USER}}'),
    mode: item.mode ?? '0644',
    stage,
    renderVariables: item.renderVariables !== false
  })
}

/**
 * @param {string} draftRoot
 * @param {object} lab
 * @param {Array<{
 *   sourcePath: string
 *   destPath: string
 *   scope?: string
 *   owner?: string
 *   group?: string
 *   mode?: string
 *   stage?: string
 *   renderVariables?: boolean
 * }>} imports
 */
export function applyImportsToDraft(draftRoot, lab, imports) {
  for (const item of imports) {
    const rel = String(item.destPath).replace(/^\//, '')
    const stat = fs.statSync(item.sourcePath)
    copyIntoDraftFiles(draftRoot, item.sourcePath, rel)
    addImportToLabFilesystem(lab, {
      ...item,
      scope: item.scope === 'workstation' ? 'workstation' : 'target',
      isDirectory: stat.isDirectory()
    })
  }
  syncFilesystemFields(lab)
  return lab
}

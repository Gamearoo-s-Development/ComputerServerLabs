/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { getLabsPath, getOnlineLabsRoot } from './utils/paths.js'
import { logger } from './utils/logger.js'

/** Top-level labs/ dirs that are not lab packs */
export const LAB_TREE_CONTAINER_DIRS = new Set(['common', '_shared', 'bundled', 'community'])

/**
 * @typedef {{
 *   folder: string
 *   labsRoot: string
 *   labsTreeRoot: string
 *   relativePath: string
 *   source: 'bundled' | 'community' | 'online'
 *   bundled: boolean
 *   labId?: string
 * }} LabCatalogLocation
 */

/** @type {Map<string, LabCatalogLocation> | null} */
let locationByKeyCache = null

/**
 * @param {string} labsRoot
 * @returns {string[]}
 */
function listDirectLabFolders(labsRoot) {
  if (!fs.existsSync(labsRoot)) return []
  return fs
    .readdirSync(labsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.') && !name.startsWith('_'))
    .filter((name) => fs.existsSync(path.join(labsRoot, name, 'lab.json')))
}

/**
 * @param {string} labJsonPath
 */
function readLabIdFromFile(labJsonPath) {
  try {
    const data = JSON.parse(fs.readFileSync(labJsonPath, 'utf8'))
    return typeof data?.id === 'string' ? data.id : null
  } catch {
    return null
  }
}

/**
 * @param {LabCatalogLocation} location
 */
function registerLocation(locations, location) {
  const labJsonPath = path.join(location.labsRoot, location.folder, 'lab.json')
  const labId = readLabIdFromFile(labJsonPath) ?? location.folder
  location.labId = labId
  locations.push(location)
}

/**
 * Discover lab pack folders under the labs tree and online installs.
 * @returns {LabCatalogLocation[]}
 */
export function discoverLabLocations() {
  const treeRoot = getLabsPath()
  /** @type {LabCatalogLocation[]} */
  const locations = []

  for (const folder of listDirectLabFolders(treeRoot)) {
    if (LAB_TREE_CONTAINER_DIRS.has(folder)) continue
    registerLocation(locations, {
      folder,
      labsRoot: treeRoot,
      labsTreeRoot: treeRoot,
      relativePath: folder,
      source: 'bundled',
      bundled: true
    })
  }

  const bundledRoot = path.join(treeRoot, 'bundled')
  if (fs.existsSync(bundledRoot)) {
    for (const trackEntry of fs.readdirSync(bundledRoot, { withFileTypes: true })) {
      if (!trackEntry.isDirectory() || trackEntry.name.startsWith('_') || trackEntry.name.startsWith('.')) {
        continue
      }
      const trackPath = path.join(bundledRoot, trackEntry.name)
      for (const folder of listDirectLabFolders(trackPath)) {
        registerLocation(locations, {
          folder,
          labsRoot: trackPath,
          labsTreeRoot: treeRoot,
          relativePath: path.join('bundled', trackEntry.name, folder),
          source: 'bundled',
          bundled: true
        })
      }
    }
  }

  const communityExamplesRoot = path.join(treeRoot, 'community', 'examples')
  if (fs.existsSync(communityExamplesRoot)) {
    for (const trackEntry of fs.readdirSync(communityExamplesRoot, { withFileTypes: true })) {
      if (
        !trackEntry.isDirectory() ||
        trackEntry.name.startsWith('_') ||
        trackEntry.name.startsWith('.') ||
        trackEntry.name === 'template'
      ) {
        continue
      }
      const trackPath = path.join(communityExamplesRoot, trackEntry.name)
      for (const folder of listDirectLabFolders(trackPath)) {
        registerLocation(locations, {
          folder,
          labsRoot: trackPath,
          labsTreeRoot: treeRoot,
          relativePath: path.join('community', 'examples', trackEntry.name, folder),
          source: 'community',
          bundled: false
        })
      }
    }
  }

  const onlineRoot = getOnlineLabsRoot()
  if (fs.existsSync(onlineRoot)) {
    for (const folder of listDirectLabFolders(onlineRoot)) {
      registerLocation(locations, {
        folder,
        labsRoot: onlineRoot,
        labsTreeRoot: onlineRoot,
        relativePath: folder,
        source: 'online',
        bundled: false
      })
    }
  }

  return dedupeLabLocations(locations)
}

/**
 * Prefer bundled > community > online when duplicate lab ids exist.
 * @param {LabCatalogLocation[]} locations
 */
function dedupeLabLocations(locations) {
  const priority = { bundled: 0, community: 1, online: 2 }
  /** @type {Map<string, LabCatalogLocation>} */
  const byId = new Map()

  for (const loc of locations) {
    const key = loc.labId ?? loc.folder
    const existing = byId.get(key)
    if (!existing || priority[loc.source] < priority[existing.source]) {
      byId.set(key, loc)
    } else if (process.env.NODE_ENV !== 'production' && existing) {
      logger.debug('labCatalog', 'Skipping duplicate lab id', {
        labId: key,
        kept: existing.relativePath,
        skipped: loc.relativePath
      })
    }
  }

  return [...byId.values()]
}

/**
 * @returns {Map<string, LabCatalogLocation>}
 */
export function getLabLocationIndex() {
  if (!locationByKeyCache) {
    const index = new Map()
    for (const loc of discoverLabLocations()) {
      index.set(loc.folder, loc)
      if (loc.labId && loc.labId !== loc.folder) {
        index.set(loc.labId, loc)
      }
    }
    locationByKeyCache = index
  }
  return locationByKeyCache
}

export function clearLabLocationCache() {
  locationByKeyCache = null
}

/**
 * @param {string} labIdOrFolder
 * @returns {LabCatalogLocation | null}
 */
export function resolveLabCatalogLocation(labIdOrFolder) {
  return getLabLocationIndex().get(labIdOrFolder) ?? null
}

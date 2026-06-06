/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { closeDatabase, initDatabase } from './db/database.js'
import { logger } from './utils/logger.js'
import { getUserDataFile, getUserDataRoot } from './utils/paths.js'

const DATA_README = `Computer Server Labs — local data folder

This folder is created by the app under your user profile (Electron userData).
It is safe to delete when the app is closed — you will lose local progress,
settings, and lab session secrets.

Nothing here is bundled with the installer. Labs and config ship read-only
inside the application package.

Subfolders:
  profile/              Lab profile, activity feed
  sessions/             Per-session credential records (lab-only, never synced)
  lab-builder/          Developer Mode — Lab Builder only (see drafts/ below)
    drafts/             Your lab drafts (not bundled catalog labs)
  logs/                 Application logs (optional)
  cache/                Temporary cache

Progress database: progress.db (SQLite)

Labs run on Docker only. VM support is not currently included.
`

/**
 * @returns {Record<string, string>}
 */
export function getDataLayout() {
  const root = getUserDataRoot()
  return {
    root,
    database: getUserDataFile('progress.db'),
    labProfile: path.join(root, 'profile', 'lab-profile.json'),
    activity: path.join(root, 'profile', 'activity.json'),
    sessions: path.join(root, 'sessions'),
    labBuilder: path.join(root, 'lab-builder'),
    labBuilderDrafts: path.join(root, 'lab-builder', 'drafts'),
    logs: path.join(root, 'logs'),
    cache: path.join(root, 'cache'),
    readme: path.join(root, 'DATA_FOLDER.txt')
  }
}

export function ensureDataDirectories() {
  const layout = getDataLayout()
  for (const dir of [
    path.dirname(layout.labProfile),
    layout.sessions,
    layout.logs,
    layout.cache,
    layout.labBuilderDrafts
  ]) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(layout.readme)) {
    fs.writeFileSync(layout.readme, DATA_README, 'utf8')
  }
  logger.info('data', 'User data directories ready', { root: layout.root })
  return layout
}

export function getDataDirectoryInfo() {
  const layout = getDataLayout()
  ensureDataDirectories()
  return {
    ...layout,
    platform: process.platform,
    isPackaged: app.isPackaged
  }
}

/**
 * @param {{ keepSettings?: boolean }} [options]
 */
export function resetAllLocalData(options = {}) {
  const layout = getDataLayout()
  const keepSettings = options.keepSettings === true

  closeDatabase()

  /** @type {string[]} */
  const toRemove = [
    layout.database,
    `${layout.database}-wal`,
    `${layout.database}-shm`,
    layout.labProfile,
    layout.activity,
    getUserDataFile('profile.json')
  ]

  if (!keepSettings) {
    // settings live in SQLite — full reset clears them via db delete
  }

  if (fs.existsSync(layout.sessions)) {
    for (const file of fs.readdirSync(layout.sessions)) {
      toRemove.push(path.join(layout.sessions, file))
    }
  }

  for (const target of toRemove) {
    try {
      if (fs.existsSync(target)) fs.rmSync(target, { force: true, recursive: true })
    } catch (error) {
      logger.warn('data', 'Failed to remove user data path', {
        target,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  ensureDataDirectories()
  initDatabase()
  logger.info('data', 'Local user data reset', { keepSettings })
  return getDataDirectoryInfo()
}

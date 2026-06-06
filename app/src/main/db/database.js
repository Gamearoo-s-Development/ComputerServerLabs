/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import { getProjectRoot, getUserDataFile } from '../utils/paths.js'
import { logger } from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('better-sqlite3').Database | null} */
let db = null

/** @type {{ ready: boolean, path: string | null }} */
let state = { ready: false, path: null }

function resolveSchemaPath() {
  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.join(__dirname, '../db/schema.sql'),
    path.join(getProjectRoot(), 'src/main/db/schema.sql'),
    process.resourcesPath ? path.join(process.resourcesPath, 'db/schema.sql') : null
  ].filter(Boolean)

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

const SCHEMA_VERSION = 1

/**
 * @param {import('better-sqlite3').Database} database
 */
function applyMigrations(database) {
  const current = Number(database.pragma('user_version', { simple: true })) || 0
  if (current >= SCHEMA_VERSION) return

  if (current < 1) {
    database.pragma('user_version = 1')
  }
}

function applySchema(database) {
  const schemaPath = resolveSchemaPath()
  if (schemaPath) {
    database.exec(fs.readFileSync(schemaPath, 'utf8'))
    return
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      total_completed INTEGER NOT NULL DEFAULT 0,
      validation_passes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lab_progress (
      lab_id TEXT PRIMARY KEY,
      completed INTEGER NOT NULL DEFAULT 0,
      best_time_sec INTEGER,
      hints_used INTEGER NOT NULL DEFAULT 0,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS lab_sessions (
      session_id TEXT PRIMARY KEY,
      lab_id TEXT NOT NULL,
      container_id TEXT,
      ports_json TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      validation_state TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS achievements (
      achievement_id TEXT PRIMARY KEY,
      unlocked_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS question_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT NOT NULL,
      correct INTEGER NOT NULL DEFAULT 0,
      answered_at TEXT NOT NULL
    );
    INSERT OR IGNORE INTO user_profile (id, xp, level, total_completed, validation_passes, created_at, updated_at)
    VALUES (1, 0, 1, 0, 0, datetime('now'), datetime('now'));
  `)
}

export function initDatabase() {
  if (db) return state

  const dbPath = getUserDataFile('progress.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  try {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    applySchema(db)
    applyMigrations(db)
    state = { ready: true, path: dbPath }
    logger.info('db', 'SQLite initialized', { path: dbPath })
  } catch (error) {
    state = { ready: false, path: dbPath }
    logger.error('db', 'SQLite init failed', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  return state
}

export function getDatabase() {
  if (!db) {
    initDatabase()
  }
  if (!db) {
    throw new Error('Database is not available')
  }
  return db
}

export function getDatabaseState() {
  return state
}

export function closeDatabase() {
  if (db) {
    try {
      db.close()
    } catch {
      // ignore close errors
    }
    db = null
  }
  state = { ready: false, path: state.path }
}

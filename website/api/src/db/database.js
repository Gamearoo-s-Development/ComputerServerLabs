/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import mysql from 'mysql2/promise'
import { config } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('better-sqlite3').Database | null} */
let sqliteDb = null
/** @type {import('mysql2/promise').Pool | null} */
let mariaPool = null
/** @type {'sqlite' | 'mariadb' | null} */
let driverKind = null

export function isMariaDb() {
  return driverKind === 'mariadb'
}

function createStatement(sql) {
  return {
    /** @param {...unknown} params */
    async get(...params) {
      if (driverKind === 'sqlite') {
        return sqliteDb.prepare(sql).get(...params)
      }
      const [rows] = await mariaPool.query(sql, params)
      return rows[0]
    },
    /** @param {...unknown} params */
    async all(...params) {
      if (driverKind === 'sqlite') {
        return sqliteDb.prepare(sql).all(...params)
      }
      const [rows] = await mariaPool.query(sql, params)
      return rows
    },
    /** @param {...unknown} params */
    async run(...params) {
      if (driverKind === 'sqlite') {
        return sqliteDb.prepare(sql).run(...params)
      }
      const [result] = await mariaPool.query(sql, params)
      return result
    }
  }
}

async function initMariaDb() {
  mariaPool = mysql.createPool({
    uri: config.databaseUrl,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: 'Z',
    multipleStatements: true
  })
  await mariaPool.query('SELECT 1')
  const [tables] = await mariaPool.query("SHOW TABLES LIKE 'users'")
  if (!tables.length) {
    const schema = fs
      .readFileSync(path.join(__dirname, 'schema.mariadb.sql'), 'utf8')
      .replace(/\r\n/g, '\n')
    await mariaPool.query(schema)
  }
  driverKind = 'mariadb'
}

function initSqlite() {
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true })
  sqliteDb = new Database(config.databasePath)
  sqliteDb.pragma('journal_mode = WAL')
  sqliteDb.pragma('foreign_keys = ON')
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  sqliteDb.exec(schema)
  driverKind = 'sqlite'
}

async function runMigrations() {
  const addLabCompletionsCol =
    driverKind === 'mariadb'
      ? 'ALTER TABLE notification_preferences ADD COLUMN email_lab_completions TINYINT NOT NULL DEFAULT 1'
      : 'ALTER TABLE notification_preferences ADD COLUMN email_lab_completions INTEGER NOT NULL DEFAULT 1'

  try {
    if (driverKind === 'sqlite') {
      sqliteDb.exec(addLabCompletionsCol)
    } else {
      await mariaPool.query(addLabCompletionsCol)
    }
  } catch {
    // column already exists
  }

  const addLabDeploymentReadyCol =
    driverKind === 'mariadb'
      ? 'ALTER TABLE notification_preferences ADD COLUMN email_lab_deployment_ready TINYINT NOT NULL DEFAULT 1'
      : 'ALTER TABLE notification_preferences ADD COLUMN email_lab_deployment_ready INTEGER NOT NULL DEFAULT 1'

  try {
    if (driverKind === 'sqlite') {
      sqliteDb.exec(addLabDeploymentReadyCol)
    } else {
      await mariaPool.query(addLabDeploymentReadyCol)
    }
  } catch {
    // column already exists
  }

  if (driverKind === 'mariadb') {
    try {
      await mariaPool.query('ALTER TABLE email_action_tokens MODIFY kind VARCHAR(64) NOT NULL')
    } catch {
      // already widened or table missing
    }
  }

  const { repairGlobalLeaderboardEntries } = await import('../services/leaderboard.js')
  await repairGlobalLeaderboardEntries()
}

export async function initDatabase() {
  if (driverKind) return getDb()
  if (config.databaseUrl) {
    await initMariaDb()
  } else {
    initSqlite()
  }
  await runMigrations()
  return getDb()
}

/** Close DB handles so short-lived scripts (seed) can exit cleanly. */
export async function closeDatabase() {
  if (mariaPool) {
    await mariaPool.end()
    mariaPool = null
  }
  if (sqliteDb) {
    sqliteDb.close()
    sqliteDb = null
  }
  driverKind = null
}

export function getDb() {
  if (!driverKind) {
    throw new Error('Database not initialized — call initDatabase() first')
  }
  return {
    prepare(sql) {
      return createStatement(sql)
    }
  }
}

export function nowIso() {
  return new Date().toISOString()
}

export function newId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/** @param {unknown} value */
export function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback
  try {
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}

/** @param {unknown} value */
export function toJson(value) {
  return JSON.stringify(value ?? null)
}

export async function auditLog(actorId, action, targetType, targetId, details = {}) {
  await getDb()
    .prepare(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(newId('audit'), actorId ?? null, action, targetType ?? null, targetId ?? null, toJson(details), nowIso())
}

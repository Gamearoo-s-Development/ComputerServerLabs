/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_ROOT = path.resolve(__dirname, '..')

/** @param {string} key @param {string} [fallback] */
function env(key, fallback = '') {
  const value = process.env[key]
  return value !== undefined && value !== '' ? value : fallback
}

function loadDotEnv() {
  const envPath = path.join(SERVER_ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (process.env[k] === undefined) {
      process.env[k] = v.replace(/\\n/g, '\n')
    }
  }
}

loadDotEnv()

function resolveDatabaseUrl() {
  const direct = env('DATABASE_URL', '')
  if (direct) return direct
  const host = env('MARIADB_HOST', '')
  if (!host) return ''
  const user = env('MARIADB_USER', 'registry')
  const password = env('MARIADB_PASSWORD', 'registry')
  const database = env('MARIADB_DATABASE', 'registry')
  const port = env('MARIADB_PORT', '3306')
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
}

export const config = {
  port: Number(env('PORT', '8787')),
  host: env('HOST', '127.0.0.1'),
  nodeEnv: env('NODE_ENV', 'development'),
  publicBaseUrl: env('PUBLIC_BASE_URL', 'http://127.0.0.1:8787').replace(/\/$/, ''),
  websiteBaseUrl: env('WEBSITE_BASE_URL', 'http://127.0.0.1:8080').replace(/\/$/, ''),
  databaseUrl: resolveDatabaseUrl(),
  databasePath: path.resolve(SERVER_ROOT, env('DATABASE_PATH', './data/registry.db')),
  labPacksDir: path.resolve(SERVER_ROOT, env('LAB_PACKS_DIR', './data/lab-packs')),
  jwtSecret: env('JWT_SECRET', 'dev-only-change-me-in-production-32chars'),
  jwtAccessTtlSec: Number(env('JWT_ACCESS_TTL_SEC', '3600')),
  jwtRefreshTtlSec: Number(env('JWT_REFRESH_TTL_SEC', '2592000')),
  labSigningPrivateKey: env('LAB_SIGNING_PRIVATE_KEY', ''),
  labSigningPublicKey: env('LAB_SIGNING_PUBLIC_KEY', ''),
  emailProvider: env('EMAIL_PROVIDER', 'console'),
  /** Default From if a channel-specific address is unset */
  emailFrom: env('EMAIL_FROM', 'noreply@example.com'),
  /** verify@ — verification / resend verification */
  emailFromVerify: env('EMAIL_FROM_VERIFY', ''),
  /** notifications@ — lab alerts, completions, milestones, security */
  emailFromNotifications: env('EMAIL_FROM_NOTIFICATIONS', ''),
  /** noreply@ — password reset and other transactional */
  emailFromNoreply: env('EMAIL_FROM_NOREPLY', ''),
  emailFromName: env('EMAIL_FROM_NAME', 'Computer Server Labs'),
  emailReplyTo: env('EMAIL_REPLY_TO', ''),
  smtp: {
    host: env('SMTP_HOST'),
    port: Number(env('SMTP_PORT', '587')),
    /** Set SMTP_SECURE=true for port 465; leave unset/false for 587 (STARTTLS). */
    secure: env('SMTP_SECURE', ''),
    user: env('SMTP_USER'),
    pass: env('SMTP_PASS')
  },
  resendApiKey: env('RESEND_API_KEY'),
  sendgridApiKey: env('SENDGRID_API_KEY'),
  rateLimitGlobal: Number(env('RATE_LIMIT_GLOBAL', '120')),
  rateLimitAuth: Number(env('RATE_LIMIT_AUTH', '20')),
  adminEmail: env('ADMIN_EMAIL', '').toLowerCase(),
  /** Public URL for desktop app downloads (GitHub Releases page or latest .exe/.dmg asset). */
  desktopDownloadUrl: env('DESKTOP_DOWNLOAD_URL', env('GITHUB_RELEASES_URL', '')).replace(/\/$/, '')
}

export const LAB_BADGES = [
  'bundled',
  'catalog-only',
  'official',
  'verified',
  'community',
  'unverified',
  'deprecated',
  'security-simulation',
  'requires-desktop-runtime',
  'docker-only'
]

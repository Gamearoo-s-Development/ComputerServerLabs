/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import crypto from 'crypto'
import { config } from '../config.js'
import { getDb, nowIso } from '../db/database.js'
import { storeActionToken } from './emailActionTokens.js'
import {
  ensureNotificationPreferences,
  mapNotificationPreferences
} from './notificationPreferences.js'

/** @typedef {keyof typeof UNSUBSCRIBE_SCOPE_LABELS} UnsubscribeScope */

/** Preference column or `all` */
export const UNSUBSCRIBE_SCOPE_LABELS = {
  email_lab_updates: 'Lab update emails',
  email_new_verified_labs: 'New verified lab announcements',
  email_lab_completions: 'Lab completion emails',
  email_lab_deployment_ready: 'Lab deployment ready emails',
  email_leaderboard_milestones: 'Leaderboard milestone emails',
  email_security_alerts: 'Security alert emails',
  all: 'All optional notification emails'
}

/** @type {Record<string, string | null>} */
export const TEMPLATE_UNSUBSCRIBE_SCOPE = {
  lab_update: 'email_lab_updates',
  new_verified_lab: 'email_new_verified_labs',
  lab_completed: 'email_lab_completions',
  lab_deployment_ready: 'email_lab_deployment_ready',
  leaderboard_milestone: 'email_leaderboard_milestones',
  security_alert: 'email_security_alerts',
  lab_notifications_enabled: 'email_lab_updates'
}

const PREFERENCE_COLUMNS = new Set(Object.keys(UNSUBSCRIBE_SCOPE_LABELS).filter((k) => k !== 'all'))

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** DB-safe token kinds (MariaDB `kind` column length limit) */
const UNSUBSCRIBE_KIND_BY_SCOPE = {
  email_lab_updates: 'unsub:lab_updates',
  email_new_verified_labs: 'unsub:new_labs',
  email_lab_completions: 'unsub:lab_done',
  email_lab_deployment_ready: 'unsub:lab_deploy',
  email_leaderboard_milestones: 'unsub:leaderboard',
  email_security_alerts: 'unsub:security',
  all: 'unsub:all'
}

/**
 * @param {string} scope
 */
function unsubscribeTokenKindForScope(scope) {
  const kind = UNSUBSCRIBE_KIND_BY_SCOPE[scope]
  if (!kind) throw new Error('Invalid unsubscribe scope')
  return kind
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * @param {string} templateId
 */
export function isUnsubscribableTemplate(templateId) {
  return Boolean(TEMPLATE_UNSUBSCRIBE_SCOPE[templateId])
}

/**
 * @param {string} templateId
 * @returns {string | null}
 */
export function getUnsubscribeScopeForTemplate(templateId) {
  return TEMPLATE_UNSUBSCRIBE_SCOPE[templateId] ?? null
}

/**
 * @param {string} userId
 * @param {string} scope
 */
export async function createUnsubscribeToken(userId, scope) {
  if (scope !== 'all' && !PREFERENCE_COLUMNS.has(scope)) {
    throw new Error('Invalid unsubscribe scope')
  }
  return storeActionToken(userId, unsubscribeTokenKindForScope(scope), ONE_YEAR_MS)
}

/**
 * @param {string} scope
 */
export function buildUnsubscribeUrl(token, scope) {
  const base = config.websiteBaseUrl.replace(/\/$/, '')
  const params = new URLSearchParams({
    token,
    scope
  })
  return `${base}/unsubscribe?${params.toString()}`
}

const UNSUBSCRIBE_PLACEHOLDER = '<!-- EMAIL_UNSUBSCRIBE -->'

/**
 * @param {{ subject: string, text: string, html?: string }} rendered
 * @param {{ scope: string, scopeToken: string, allToken: string, scopeLabel: string }} links
 */
export function appendUnsubscribeFooter(rendered, links) {
  const scopeUrl = buildUnsubscribeUrl(links.scopeToken, links.scope)
  const allUrl = buildUnsubscribeUrl(links.allToken, 'all')
  const manageUrl = `${config.websiteBaseUrl.replace(/\/$/, '')}/`

  const textFooter = [
    '',
    '—',
    `Unsubscribe from ${links.scopeLabel}: ${scopeUrl}`,
    `Unsubscribe from all optional notification emails: ${allUrl}`,
    `Manage preferences (sign in): ${manageUrl}`
  ].join('\n')

  const htmlFooter = `<tr><td style="padding:24px 32px 0;border-top:1px solid #334155;">
      <p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:#94a3b8;">
        <a href="${escapeAttr(scopeUrl)}" style="color:#0ea5e9;text-decoration:underline;font-weight:600;">Unsubscribe</a>
        from ${escapeHtml(links.scopeLabel)} only
        &nbsp;·&nbsp;
        <a href="${escapeAttr(allUrl)}" style="color:#0ea5e9;text-decoration:underline;font-weight:600;">Unsubscribe from all</a>
        optional notification emails
      </p>
      <p style="margin:0;font-size:11px;line-height:1.5;color:#64748b;">
        Verification and password reset emails are not affected. Re-enable anytime in the desktop app under Account → Email notifications.
      </p>
    </td></tr>`

  let html = rendered.html
  if (html) {
    if (html.includes(UNSUBSCRIBE_PLACEHOLDER)) {
      html = html.replace(UNSUBSCRIBE_PLACEHOLDER, htmlFooter)
    } else {
      // Fallback: insert before the branded footer row inside the card table
      html = html.replace(
        '<tr><td style="padding:32px;">',
        `${htmlFooter}<tr><td style="padding:32px;">`
      )
    }
  }

  return {
    subject: rendered.subject,
    text: `${rendered.text}${textFooter}`,
    html,
    unsubscribeUrl: scopeUrl,
    listUnsubscribeUrl: scopeUrl
  }
}

/**
 * @param {string} token
 * @param {string} scope
 */
export async function processEmailUnsubscribe(token, scope) {
  const trimmed = String(token ?? '').trim()
  const normalizedScope = String(scope ?? '').trim()
  if (!trimmed) throw new Error('Unsubscribe link is missing a token')
  if (normalizedScope !== 'all' && !PREFERENCE_COLUMNS.has(normalizedScope)) {
    throw new Error('Invalid unsubscribe scope')
  }

  const expectedKind = unsubscribeTokenKindForScope(normalizedScope)
  const db = getDb()
  const row = await db
    .prepare(
      `SELECT * FROM email_action_tokens
       WHERE token_hash = ? AND kind = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(hashToken(trimmed), expectedKind)

  if (!row) {
    throw new Error('This unsubscribe link is invalid or does not match this email type')
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error('This unsubscribe link has expired. Use Account settings in the app to manage emails.')
  }

  const ts = nowIso()
  if (!row.used_at) {
    await applyUnsubscribePreference(row.user_id, normalizedScope)
    await db.prepare('UPDATE email_action_tokens SET used_at = ? WHERE id = ?').run(ts, row.id)
  } else {
    // Idempotent — preferences already applied
    await applyUnsubscribePreference(row.user_id, normalizedScope)
  }

  const prefs = await ensureNotificationPreferences(row.user_id)
  const user = await db.prepare('SELECT email FROM users WHERE id = ?').get(row.user_id)

  return {
    scope: normalizedScope,
    scopeLabel: UNSUBSCRIBE_SCOPE_LABELS[normalizedScope] ?? normalizedScope,
    email: user?.email ?? null,
    preferences: mapNotificationPreferences(prefs),
    alreadyUnsubscribed: Boolean(row.used_at)
  }
}

/**
 * @param {string} userId
 * @param {string} scope
 */
async function applyUnsubscribePreference(userId, scope) {
  await ensureNotificationPreferences(userId)
  const db = getDb()
  const ts = nowIso()
  if (scope === 'all') {
    await db
      .prepare(
        `UPDATE notification_preferences SET
          email_lab_updates = 0,
          email_new_verified_labs = 0,
          email_lab_completions = 0,
          email_lab_deployment_ready = 0,
          email_leaderboard_milestones = 0,
          email_security_alerts = 0,
          updated_at = ?
         WHERE user_id = ?`
      )
      .run(ts, userId)
    return
  }
  await db
    .prepare(`UPDATE notification_preferences SET ${scope} = 0, updated_at = ? WHERE user_id = ?`)
    .run(ts, userId)
}

/** @param {string} value */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** @param {string} value */
function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;')
}

/**
 * @param {string} userId
 * @param {string} templateId
 */
export async function buildUnsubscribeLinksForTemplate(userId, templateId) {
  const scope = getUnsubscribeScopeForTemplate(templateId)
  if (!scope) return null
  const scopeToken = await createUnsubscribeToken(userId, scope)
  const allToken = await createUnsubscribeToken(userId, 'all')
  return {
    scope,
    scopeToken,
    allToken,
    scopeLabel: UNSUBSCRIBE_SCOPE_LABELS[scope] ?? scope
  }
}

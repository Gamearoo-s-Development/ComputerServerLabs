/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getDb } from '../db/database.js'
import {
  appendUnsubscribeFooter,
  buildUnsubscribeLinksForTemplate,
  isUnsubscribableTemplate
} from './emailUnsubscribe.js'
import { sendEmailTransport } from './emailTransport.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Load the canonical account email from the database (never from client-supplied "to").
 * @param {string | { id?: string, email?: string }} userOrId
 */
export async function resolveAccountForEmail(userOrId) {
  const db = getDb()
  const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id
  if (!userId) {
    throw new Error('Account email unavailable')
  }
  const row = await db
    .prepare('SELECT id, email, display_name, email_verified FROM users WHERE id = ?')
    .get(userId)
  if (!row?.email) {
    throw new Error('Account email unavailable')
  }
  const email = String(row.email).trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    throw new Error('Invalid account email on file')
  }
  return {
    id: row.id,
    email,
    displayName: row.display_name,
    emailVerified: row.email_verified === 1
  }
}

/**
 * @param {string} raw
 */
export function normalizeAccountEmail(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

/**
 * @param {string} email
 */
export async function findAccountByEmail(email) {
  const normalized = normalizeAccountEmail(email)
  if (!normalized || !EMAIL_RE.test(normalized)) return null
  const row = await getDb().prepare('SELECT id FROM users WHERE email = ?').get(normalized)
  if (!row?.id) return null
  return resolveAccountForEmail(row.id)
}

/**
 * Send a server-rendered message only to the account email on file.
 * @param {Awaited<ReturnType<typeof resolveAccountForEmail>>} account
 * @param {{ subject: string, text: string, html?: string }} rendered
 * @param {string} templateId — selects From address (verify / notifications / noreply)
 */
export async function sendAccountEmail(account, rendered, templateId) {
  let outbound = rendered
  let listUnsubscribeUrl

  if (isUnsubscribableTemplate(templateId)) {
    try {
      const links = await buildUnsubscribeLinksForTemplate(account.id, templateId)
      if (links) {
        outbound = appendUnsubscribeFooter(rendered, links)
        listUnsubscribeUrl = outbound.listUnsubscribeUrl
        if (!outbound.html?.includes('Unsubscribe from')) {
          console.warn('[registry-email] Unsubscribe links missing from HTML after append', { templateId })
        }
      }
    } catch (error) {
      console.warn('[registry-email] Unsubscribe footer skipped; sending without it', {
        templateId,
        error: String(error)
      })
    }
  }

  return sendEmailTransport({
    to: account.email,
    templateId,
    listUnsubscribeUrl,
    subject: outbound.subject,
    text: outbound.text,
    html: outbound.html
  })
}

/**
 * @param {Awaited<ReturnType<typeof resolveAccountForEmail>>} account
 */
export function accountTemplateContext(account, extra = {}) {
  return {
    displayName: account.displayName,
    accountEmail: account.email,
    ...extra
  }
}

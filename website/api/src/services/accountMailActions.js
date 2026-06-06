/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  accountTemplateContext,
  resolveAccountForEmail,
  sendAccountEmail
} from './accountEmail.js'
import { renderEmailTemplate } from './emailTemplates.js'
import { storeEmailActionTokenForUser } from './emailActionTokens.js'

/**
 * @param {string | { id: string }} accountOrUserId
 */
export async function sendVerificationEmailForAccount(accountOrUserId) {
  const account = await resolveAccountForEmail(accountOrUserId)
  const tokenRef = await storeEmailActionTokenForUser(account.id, 'verification')
  const rendered = renderEmailTemplate(
    'verification',
    accountTemplateContext(account, { tokenRef })
  )
  const result = await sendAccountEmail(account, rendered, 'verification')
  return { ...result, sentTo: account.email }
}

/**
 * @param {string | { id: string }} accountOrUserId
 */
export async function sendPasswordResetEmailForAccount(accountOrUserId) {
  const account = await resolveAccountForEmail(accountOrUserId)
  const tokenRef = await storeEmailActionTokenForUser(account.id, 'password_reset')
  const rendered = renderEmailTemplate(
    'password_reset',
    accountTemplateContext(account, { tokenRef })
  )
  const result = await sendAccountEmail(account, rendered, 'password_reset')
  return { ...result, sentTo: account.email }
}

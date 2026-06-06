/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { config } from '../config.js'

/** @typedef {'verify' | 'notifications' | 'noreply'} EmailFromChannel */

/** @type {Record<string, EmailFromChannel>} */
const TEMPLATE_CHANNEL = {
  verification: 'verify',
  password_reset: 'noreply',
  lab_update: 'notifications',
  leaderboard_milestone: 'notifications',
  security_alert: 'notifications',
  lab_notifications_enabled: 'notifications',
  lab_completed: 'notifications',
  new_verified_lab: 'notifications',
  lab_deployment_ready: 'notifications'
}

/**
 * @param {string} templateId
 * @returns {EmailFromChannel}
 */
export function getEmailChannelForTemplate(templateId) {
  return TEMPLATE_CHANNEL[templateId] ?? 'noreply'
}

/**
 * From address for outbound mail (must be allowed on your SMTP host / aliases).
 * @param {string} templateId
 */
export function resolveFromAddressForTemplate(templateId) {
  const smtpUser = String(config.smtp.user ?? '').trim()
  const channel = getEmailChannelForTemplate(templateId)
  let address
  if (channel === 'verify') {
    address = config.emailFromVerify || config.emailFrom
  } else if (channel === 'notifications') {
    address = config.emailFromNotifications || config.emailFrom
  } else {
    // Prefer EMAIL_FROM (often no-reply@) before EMAIL_FROM_NOREPLY (noreply@ without hyphen)
    address = config.emailFromNoreply || config.emailFrom
  }
  address = String(address ?? '').trim()
  if (!address && smtpUser) return smtpUser
  return address || config.emailFrom
}

/** @param {string} formattedFrom */
export function extractAddressFromFormattedFrom(formattedFrom) {
  const match = /<([^>]+)>/.exec(String(formattedFrom))
  return (match?.[1] ?? String(formattedFrom)).trim()
}

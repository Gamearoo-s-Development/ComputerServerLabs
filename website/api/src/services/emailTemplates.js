/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { config } from '../config.js'

const BRAND = 'Computer Server Labs'
const ACCENT = '#0ea5e9'
const ACCENT_DARK = '#0284c7'
const BG = '#0f172a'
const CARD = '#1e293b'
const TEXT = '#e2e8f0'
const MUTED = '#94a3b8'
const BORDER = '#334155'

/**
 * Server-owned email templates. Recipient/subject/body are never accepted from clients.
 * @param {string} templateId
 * @param {object} data
 */
export function renderEmailTemplate(templateId, data = {}) {
  switch (templateId) {
    case 'verification':
      return verificationTemplate(data)
    case 'password_reset':
      return passwordResetTemplate(data)
    case 'lab_update':
      return labUpdateTemplate(data)
    case 'leaderboard_milestone':
      return leaderboardMilestoneTemplate(data)
    case 'security_alert':
      return securityAlertTemplate(data)
    case 'lab_notifications_enabled':
      return labNotificationsEnabledTemplate(data)
    case 'lab_completed':
      return labCompletedTemplate(data)
    case 'new_verified_lab':
      return newVerifiedLabTemplate(data)
    case 'lab_deployment_ready':
      return labDeploymentReadyTemplate(data)
    default:
      throw new Error(`Unknown email template: ${templateId}`)
  }
}

/** @param {object} data */
function verificationTemplate(data) {
  const accountEmail = String(data.accountEmail ?? '').trim()
  const name = data.displayName ?? 'there'
  const verifyUrl = `${config.websiteBaseUrl}/verify-email?token=${encodeURIComponent(data.tokenRef ?? '')}`
  const subject = 'Verify your email address'
  const headline = 'Confirm your account'
  const intro =
    'Thanks for signing up. Please verify your email address to activate your account and link the desktop app.'

  return {
    subject,
    text: plainText({
      name,
      headline,
      intro,
      action: 'Verify your email address:',
      actionUrl: verifyUrl,
      note: 'This link expires in 24 hours. If you did not create an account, you can safely ignore this email.',
      accountEmail
    }),
    html: layout({
      preheader: 'Verify your email to activate your Computer Server Labs account.',
      headline,
      greeting: name,
      intro,
      cta: { label: 'Verify email address', url: verifyUrl },
      note: 'This link expires in <strong>24 hours</strong>. If you did not create an account, no action is required.',
      accountEmail
    })
  }
}

/** @param {object} data */
function passwordResetTemplate(data) {
  const accountEmail = String(data.accountEmail ?? '').trim()
  const name = data.displayName ?? 'there'
  const resetUrl = `${config.websiteBaseUrl}/reset-password?token=${encodeURIComponent(data.tokenRef ?? '')}`
  const subject = 'Reset your password'
  const headline = 'Password reset requested'
  const intro =
    'We received a request to reset the password for your account. Use the button below to choose a new password.'

  return {
    subject,
    text: plainText({
      name,
      headline,
      intro,
      action: 'Reset your password:',
      actionUrl: resetUrl,
      note: 'This link expires in 1 hour. If you did not request a reset, ignore this email — your password will not change.',
      accountEmail
    }),
    html: layout({
      preheader: 'Reset your Computer Server Labs password.',
      headline,
      greeting: name,
      intro,
      cta: { label: 'Reset password', url: resetUrl },
      note: 'This link expires in <strong>1 hour</strong>. If you did not request this, you can safely ignore this email.',
      alert: 'Never share this link. Computer Server Labs staff will never ask for your password.',
      accountEmail
    })
  }
}

/** @param {object} data */
function labUpdateTemplate(data) {
  const accountEmail = String(data.accountEmail ?? '').trim()
  const name = data.displayName ?? 'there'
  const labTitle = data.labTitle ?? 'A lab you follow'
  const labId = data.labId ?? ''
  const version = data.version ?? ''
  const subject = `Lab update: ${labTitle}`
  const headline = 'New lab version available'
  const intro = labId
    ? `<strong>${escapeHtml(labTitle)}</strong> (${escapeHtml(labId)}) has a new version${version ? ` — <strong>v${escapeHtml(version)}</strong>` : ''}. Open the registry to review changes and download the latest pack.`
    : `<strong>${escapeHtml(labTitle)}</strong> has been updated. Open the registry to download the latest version.`
  const browseUrl = `${config.websiteBaseUrl}`

  return {
    subject,
    text: plainText({
      name,
      headline,
      intro: `Lab "${labTitle}" has been updated${version ? ` (v${version})` : ''}. Browse labs: ${browseUrl}`,
      note: 'You are receiving this because lab update notifications are enabled on your account.',
      accountEmail
    }),
    html: layout({
      preheader: `${labTitle} has a new version available.`,
      headline,
      greeting: name,
      intro,
      cta: { label: 'Browse labs', url: browseUrl },
      note: 'You are receiving this because <strong>lab update notifications</strong> are enabled on your account. Manage preferences from the desktop app or website.',
      accountEmail
    })
  }
}

/** @param {object} data */
function leaderboardMilestoneTemplate(data) {
  const accountEmail = String(data.accountEmail ?? '').trim()
  const name = data.displayName ?? 'Player'
  const milestone = data.milestone ?? 'You reached a new leaderboard milestone.'
  const subject = 'Leaderboard milestone reached'
  const headline = 'Congratulations!'
  const leaderboardUrl = `${config.websiteBaseUrl}`

  return {
    subject,
    text: plainText({
      name,
      headline,
      intro: milestone,
      action: 'View the leaderboard:',
      actionUrl: leaderboardUrl,
      note: 'Keep completing verified labs to climb the ranks.',
      accountEmail
    }),
    html: layout({
      preheader: 'You reached a new leaderboard milestone.',
      headline,
      greeting: name,
      intro: escapeHtml(milestone),
      highlight: '🏆 Milestone unlocked',
      cta: { label: 'View leaderboard', url: leaderboardUrl },
      note: 'Leaderboard participation is opt-in. You can change this in your account preferences.',
      accountEmail
    })
  }
}

/** @param {object} data */
function securityAlertTemplate(data) {
  const accountEmail = String(data.accountEmail ?? '').trim()
  const name = data.displayName ?? 'there'
  const message =
    data.message ?? 'We detected activity on your account that may need your attention.'
  const subject = 'Security alert for your account'
  const headline = 'Account security notice'
  const accountUrl = `${config.websiteBaseUrl}`

  return {
    subject,
    text: plainText({
      name,
      headline,
      intro: message,
      action: 'Review your account:',
      actionUrl: accountUrl,
      note: 'If this activity was not you, revoke linked devices and change your password immediately.',
      accountEmail
    }),
    html: layout({
      preheader: 'Important security notice for your Computer Server Labs account.',
      headline,
      greeting: name,
      intro: escapeHtml(message),
      alert: 'If you do not recognize this activity, revoke linked sessions and reset your password right away.',
      cta: { label: 'Review account', url: accountUrl },
      note: 'This is an automated security notification. We will never ask for your password by email.',
      accountEmail
    })
  }
}

/** @param {object} data */
function labCompletedTemplate(data) {
  const accountEmail = String(data.accountEmail ?? '').trim()
  const name = data.displayName ?? 'there'
  const labTitle = data.labTitle ?? data.labId ?? 'Lab'
  const labId = data.labId ?? ''
  const xp = data.xpEarned ?? 0
  const timeSec = data.bestTimeSec
  const hints = data.hintsUsed ?? 0
  const subject = `Lab complete: ${labTitle}`
  const headline = 'Nice work — lab completed!'
  const timeLine =
    timeSec != null && timeSec > 0 ? ` Completion time: <strong>${formatDuration(timeSec)}</strong>.` : ''
  const intro = `You completed <strong>${escapeHtml(labTitle)}</strong>${labId ? ` (${escapeHtml(labId)})` : ''} and earned <strong>${xp} XP</strong>.${timeLine}${hints ? ` Hints used: ${hints}.` : ''}`
  const labsUrl = `${config.websiteBaseUrl}`

  return {
    subject,
    text: plainText({
      name,
      headline,
      intro: `You completed "${labTitle}" and earned ${xp} XP.${timeSec ? ` Time: ${formatDuration(timeSec)}.` : ''}`,
      action: 'Browse more labs:',
      actionUrl: labsUrl,
      note: 'Progress was synced from your linked desktop app. Terminal commands and lab passwords are never included in emails.',
      accountEmail
    }),
    html: layout({
      preheader: `You completed ${labTitle} and earned ${xp} XP.`,
      headline,
      greeting: name,
      intro,
      highlight: `+${xp} XP · Lab complete`,
      cta: { label: 'Browse labs', url: labsUrl },
      note: 'This confirmation was sent because <strong>lab completion emails</strong> are enabled on your account.',
      accountEmail
    })
  }
}

/** @param {object} data */
function newVerifiedLabTemplate(data) {
  const accountEmail = String(data.accountEmail ?? '').trim()
  const name = data.displayName ?? 'there'
  const labTitle = data.labTitle ?? 'New verified lab'
  const labId = data.labId ?? ''
  const version = data.version ?? ''
  const subject = `New verified lab ready: ${labTitle}`
  const headline = 'A verified lab is ready'
  const intro = `<strong>${escapeHtml(labTitle)}</strong>${labId ? ` (${escapeHtml(labId)})` : ''} is now verified${version ? ` at version <strong>v${escapeHtml(version)}</strong>` : ''} and ready to download in the desktop app under <strong>Online Labs</strong>.`
  const labUrl = labId ? `${config.websiteBaseUrl}/labs/${encodeURIComponent(labId)}` : `${config.websiteBaseUrl}`

  return {
    subject,
    text: plainText({
      name,
      headline,
      intro: `${labTitle} is verified and ready to download.${version ? ` Version ${version}.` : ''}`,
      action: 'View lab details:',
      actionUrl: labUrl,
      note: 'You are receiving this because new verified lab announcements are enabled on your account.',
      accountEmail
    }),
    html: layout({
      preheader: `${labTitle} is verified and ready to play.`,
      headline,
      greeting: name,
      intro,
      highlight: '✓ Verified lab ready',
      cta: { label: 'View lab', url: labUrl },
      note: 'You are receiving this because <strong>new verified lab</strong> emails are enabled on your account.',
      accountEmail
    })
  }
}

/** @param {number} sec */
function formatDuration(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m <= 0) return `${s}s`
  return `${m}m ${s}s`
}

/** @param {object} data */
function labDeploymentReadyTemplate(data) {
  const accountEmail = String(data.accountEmail ?? '').trim()
  const name = data.displayName ?? 'there'
  const labTitle = data.labTitle ?? 'Your lab'
  const labId = data.labId ?? ''
  const subject = `Lab ready: ${labTitle}`
  const headline = 'Your lab environment is ready'
  const intro = `<strong>${escapeHtml(labTitle)}</strong>${labId ? ` (${escapeHtml(labId)})` : ''} finished deploying in the desktop app. Open Computer Server Labs to connect with the Lab Terminal and begin the mission.`
  const labsUrl = `${config.websiteBaseUrl}`

  return {
    subject,
    text: plainText({
      name,
      headline,
      intro: `${labTitle} is ready in the desktop app. Open Computer Server Labs and use the Lab Terminal to begin.`,
      action: 'Open the registry:',
      actionUrl: labsUrl,
      note: 'Lab passwords and terminal output are never included in emails.',
      accountEmail
    }),
    html: layout({
      preheader: `${labTitle} is ready — open the desktop app to begin.`,
      headline,
      greeting: name,
      intro,
      highlight: '✓ Lab environment ready',
      cta: { label: 'Open Computer Server Labs', url: labsUrl },
      note: 'You are receiving this because <strong>lab deployment ready</strong> emails are enabled on your linked account.',
      accountEmail
    })
  }
}

/** @param {object} data */
function labNotificationsEnabledTemplate(data) {
  const accountEmail = String(data.accountEmail ?? '').trim()
  const enabled = data.enabled === true
  const subject = enabled ? 'Lab update notifications enabled' : 'Lab update notifications disabled'
  const headline = enabled ? 'Notifications turned on' : 'Notifications turned off'
  const intro = enabled
    ? 'You will now receive email when labs you follow publish new verified versions.'
    : 'You will no longer receive lab update emails. You can re-enable this anytime in account settings.'

  return {
    subject,
    text: plainText({
      name: data.displayName ?? 'there',
      headline,
      intro,
      note: 'This change was made from your linked account. Manage all notification preferences in the app or on the website.',
      accountEmail
    }),
    html: layout({
      preheader: subject,
      headline,
      greeting: data.displayName ?? 'there',
      intro,
      highlight: enabled ? '✓ Lab update emails enabled' : 'Lab update emails disabled',
      note: 'This change was made from your linked account. Adjust preferences anytime in the desktop app under <strong>Account → Email notifications</strong>.',
      accountEmail
    })
  }
}

/**
 * @param {object} opts
 */
function layout(opts) {
  const {
    preheader = '',
    headline,
    greeting,
    intro,
    cta,
    note,
    alert,
    highlight,
    accountEmail = ''
  } = opts

  const ctaBlock = cta
    ? `<tr><td style="padding:28px 32px 8px;text-align:center;">
        ${button(cta.label, cta.url)}
      </td></tr>
      <tr><td style="padding:8px 32px 0;text-align:center;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;">
          Or copy this link:<br>
          <a href="${escapeHtml(cta.url)}" style="color:${ACCENT};text-decoration:none;">${escapeHtml(cta.url)}</a>
        </p>
      </td></tr>`
    : ''

  const alertBlock = alert
    ? `<tr><td style="padding:16px 32px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#422006;border:1px solid #92400e;border-radius:8px;">
          <tr><td style="padding:14px 16px;font-size:13px;line-height:1.55;color:#fde68a;">
            ${escapeHtml(alert)}
          </td></tr>
        </table>
      </td></tr>`
    : ''

  const highlightBlock = highlight
    ? `<tr><td style="padding:20px 32px 0;">
        <p style="margin:0;padding:14px 16px;background:#0c4a6e;border:1px solid ${ACCENT};border-radius:8px;font-size:15px;font-weight:600;color:${TEXT};text-align:center;">
          ${escapeHtml(highlight)}
        </p>
      </td></tr>`
    : ''

  const noteBlock = note
    ? `<tr><td style="padding:24px 32px 0;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">${note}</p>
      </td></tr>`
    : ''

  const recipientBlock = accountEmail
    ? `<tr><td style="padding:20px 32px 0;">
        <p style="margin:0;font-size:12px;line-height:1.55;color:#64748b;">
          This message was sent to <strong style="color:${MUTED};">${escapeHtml(accountEmail)}</strong>
          because it is the email address on your ${escapeHtml(BRAND)} account.
        </p>
      </td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BG};">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${CARD};border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 20px;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);border-bottom:1px solid ${BORDER};">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${ACCENT};">${escapeHtml(BRAND)}</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;line-height:1.3;color:#ffffff;">${escapeHtml(headline)}</h1>
        </td></tr>
        <tr><td style="padding:28px 32px 0;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${TEXT};">Hello ${escapeHtml(greeting)},</p>
          <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">${intro}</p>
        </td></tr>
        ${highlightBlock}
        ${alertBlock}
        ${ctaBlock}
        ${noteBlock}
        ${recipientBlock}
        <!-- EMAIL_UNSUBSCRIBE -->
        <tr><td style="padding:32px;">
          <hr style="border:none;border-top:1px solid ${BORDER};margin:0 0 20px;">
          <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${MUTED};">
            Sent by ${escapeHtml(BRAND)} · Lab registry &amp; cloud sync
          </p>
          <p style="margin:0;font-size:11px;line-height:1.5;color:#64748b;">
            This is a transactional message related to your account. Please do not reply to this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * @param {string} label
 * @param {string} url
 */
function button(label, url) {
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"
    style="display:inline-block;padding:14px 28px;background:${ACCENT};background-image:linear-gradient(180deg,${ACCENT} 0%,${ACCENT_DARK} 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;box-shadow:0 2px 8px rgba(14,165,233,0.35);">
    ${escapeHtml(label)}
  </a>`
}

/**
 * @param {object} opts
 */
function plainText(opts) {
  const lines = [
    `Hello ${opts.name},`,
    '',
    opts.headline.toUpperCase(),
    '',
    stripHtml(opts.intro),
    ''
  ]
  if (opts.action && opts.actionUrl) {
    lines.push(opts.action, opts.actionUrl, '')
  }
  if (opts.note) {
    lines.push(stripHtml(opts.note), '')
  }
  if (opts.accountEmail) {
    lines.push(`This message was sent to ${opts.accountEmail} (your account email on file).`, '')
  }
  lines.push('—', BRAND, '', 'This is an automated message. Please do not reply.')
  return lines.join('\n')
}

/** @param {string} value */
function stripHtml(value) {
  return String(value).replace(/<[^>]+>/g, '')
}

/** @param {string} value */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

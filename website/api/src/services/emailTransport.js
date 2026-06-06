/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import nodemailer from 'nodemailer'
import { config } from '../config.js'
import {
  extractAddressFromFormattedFrom,
  resolveFromAddressForTemplate
} from './emailFromRouting.js'

/** @type {import('nodemailer').Transporter | null} */
let smtpTransport = null

function resolveSmtpSecure(port) {
  const explicit = String(config.smtp.secure ?? '').trim().toLowerCase()
  if (explicit === 'true' || explicit === '1' || explicit === 'yes') return true
  if (explicit === 'false' || explicit === '0' || explicit === 'no') return false
  return port === 465
}

function getSmtpTransport() {
  if (smtpTransport) return smtpTransport
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    throw new Error('SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)')
  }
  const port = config.smtp.port
  const secure = resolveSmtpSecure(port)
  smtpTransport = nodemailer.createTransport({
    host: config.smtp.host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    },
    tls: {
      minVersion: 'TLSv1.2',
      servername: config.smtp.host
    }
  })
  return smtpTransport
}

const SMTP_VERIFY_TIMEOUT_MS = 12_000

/**
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {string} label
 * @returns {Promise<T>}
 * @template T
 */
function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

/**
 * Verify SMTP credentials at startup (optional health check).
 * Never blocks API listen for longer than SMTP_VERIFY_TIMEOUT_MS.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function verifySmtpTransport() {
  if (config.emailProvider !== 'smtp') {
    return { ok: true }
  }
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    return { ok: false, error: 'SMTP_HOST, SMTP_USER, and SMTP_PASS are required when EMAIL_PROVIDER=smtp' }
  }
  try {
    const transport = getSmtpTransport()
    await withTimeout(transport.verify(), SMTP_VERIFY_TIMEOUT_MS, 'SMTP verify')
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
  }
}

/** RFC 5322 From with display name, e.g. "Computer Server Labs" <noreply@example.com> */
export function formatEmailFrom(fromAddress) {
  const address = String(fromAddress ?? config.emailFrom ?? '').trim()
  const name = String(config.emailFromName ?? '').trim()
  if (!address) return name || 'noreply@example.com'
  if (!name || address.includes('<')) return address
  const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}" <${address}>`
}

/** Reply-To address for support replies (omit when unset). */
export function formatEmailReplyTo() {
  const address = String(config.emailReplyTo ?? '').trim()
  return address || undefined
}

function buildOutboundMailPayload(mail) {
  const replyTo = formatEmailReplyTo()
  const fromAddress = mail.templateId
    ? resolveFromAddressForTemplate(mail.templateId)
    : config.emailFrom
  /** @type {Record<string, string>} */
  const headers = {}
  if (mail.listUnsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${mail.listUnsubscribeUrl}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }
  return {
    from: formatEmailFrom(fromAddress),
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html ?? undefined,
    ...(replyTo ? { replyTo } : {}),
    ...(Object.keys(headers).length ? { headers } : {})
  }
}

/**
 * Low-level email transport. Only called from server templates/triggers — never from route handlers accepting client content.
 * @param {{ to: string, subject: string, text: string, html?: string, templateId?: string, listUnsubscribeUrl?: string }} mail
 */
export async function sendEmailTransport(mail) {
  const provider = config.emailProvider
  const recipient = mail.to

  if (provider === 'console') {
    const replyTo = formatEmailReplyTo()
    console.log(
      '[registry-email]',
      redactEmail(recipient),
      mail.subject,
      replyTo ? `reply-to=${replyTo}` : '',
      mail.text.slice(0, 80)
    )
    return { ok: true, provider: 'console' }
  }

  if (provider === 'smtp') {
    await sendViaSmtp(mail)
    return { ok: true, provider: 'smtp' }
  }

  if (provider === 'resend' && config.resendApiKey) {
    const payload = buildOutboundMailPayload(mail)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        ...(payload.replyTo ? { reply_to: payload.replyTo } : {})
      })
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[registry-email] Resend failed', res.status, err.slice(0, 200))
      throw new Error('Email delivery failed')
    }
    return { ok: true, provider: 'resend' }
  }

  if (config.nodeEnv === 'development') {
    console.log('[registry-email:dev]', redactEmail(recipient), mail.subject, mail.text.slice(0, 80))
    return { ok: true, provider: 'console' }
  }

  console.warn('[registry-email] No email provider configured; message not sent', redactEmail(recipient))
  return { ok: false, provider: 'none' }
}

/** @param {string} message */
function isSenderAddressRejectedError(message) {
  return /sender address rejected|not owned by user|553\s+5\.7\.1/i.test(message)
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string, templateId?: string, listUnsubscribeUrl?: string }} mail
 */
async function sendViaSmtp(mail) {
  const transport = getSmtpTransport()
  const payload = buildOutboundMailPayload(mail)
  const smtpUser = String(config.smtp.user ?? '').trim()

  try {
    await transport.sendMail(payload)
    return
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const fromAddress = extractAddressFromFormattedFrom(payload.from)
    const canRetryWithSmtpUser =
      smtpUser &&
      fromAddress &&
      fromAddress.toLowerCase() !== smtpUser.toLowerCase() &&
      isSenderAddressRejectedError(message)

    if (canRetryWithSmtpUser) {
      console.warn(
        '[registry-email] From address rejected by SMTP server; retrying with SMTP_USER',
        { from: fromAddress, smtpUser, templateId: mail.templateId ?? null }
      )
      try {
        await transport.sendMail({ ...payload, from: formatEmailFrom(smtpUser) })
        return
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : String(retryError)
        console.error('[registry-email] SMTP send failed after From fallback', {
          to: redactEmail(mail.to),
          templateId: mail.templateId ?? null,
          error: retryMessage
        })
        throw retryError
      }
    }

    console.error('[registry-email] SMTP send failed', {
      to: redactEmail(mail.to),
      from: fromAddress,
      templateId: mail.templateId ?? null,
      error: message
    })
    throw error
  }
}

/** @param {string} email */
function redactEmail(email) {
  const [local, domain] = String(email).split('@')
  if (!domain) return '***'
  return `${local.slice(0, 2)}***@${domain}`
}

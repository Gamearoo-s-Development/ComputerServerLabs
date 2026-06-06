/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  approveDeviceAuth,
  issueTokens,
  loginUser,
  pollDeviceAuth,
  refreshAccessToken,
  registerUser,
  revokeRefreshToken,
  startDeviceAuth
} from '../services/deviceAuth.js'
import { findAccountByEmail, normalizeAccountEmail, resolveAccountForEmail } from '../services/accountEmail.js'
import {
  sendPasswordResetEmailForAccount,
  sendVerificationEmailForAccount
} from '../services/accountMailActions.js'
import { sendVerificationEmail } from '../services/email.js'
import { verifyEmailToken } from '../services/emailVerification.js'
import {
  checkRateLimit,
  logEmailAudit,
  recordRateLimit
} from '../services/notificationTrigger.js'
import { authMiddleware } from '../middleware/auth.js'

const GENERIC_ACCOUNT_EMAIL_MESSAGE =
  'If an account exists for that email address, we sent a message to that inbox.'

export async function authRoutes(app) {
  app.post('/api/auth/register', async (request, reply) => {
    const { email, password, displayName } = request.body ?? {}
    if (!email || !password || String(password).length < 8) {
      return reply.code(400).send({ error: 'Valid email and password (8+ chars) required' })
    }
    try {
      const user = await registerUser({ email, password, displayName })
      await sendVerificationEmail(user)
      const tokens = await issueTokens(user, 'website')
      return {
        ok: true,
        ...tokens,
        verificationEmailSentTo: String(user.email).trim().toLowerCase()
      }
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Registration failed' })
    }
  })

  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body ?? {}
    try {
      const user = await loginUser(email, password)
      const tokens = await issueTokens(user, 'website')
      return { ok: true, ...tokens }
    } catch {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }
  })

  app.post('/api/auth/verify-email', async (request, reply) => {
    const { token } = request.body ?? {}
    if (!token || typeof token !== 'string') {
      return reply.code(400).send({ error: 'Verification token is required' })
    }
    try {
      const result = await verifyEmailToken(token)
      return {
        ok: true,
        verified: true,
        alreadyVerified: result.alreadyVerified === true,
        email: result.email,
        displayName: result.displayName,
        message: result.alreadyVerified
          ? 'Your email was already verified.'
          : 'Your email has been verified successfully.'
      }
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Verification failed' })
    }
  })

  app.post('/api/auth/device/start', async (request) => {
    const { clientLabel } = request.body ?? {}
    return { ok: true, ...(await startDeviceAuth(clientLabel ?? 'Computer Server Labs Desktop')) }
  })

  app.post('/api/auth/device/poll', async (request, reply) => {
    const { deviceCode } = request.body ?? {}
    if (!deviceCode) return reply.code(400).send({ error: 'deviceCode required' })
    const result = await pollDeviceAuth(deviceCode)
    return { ok: true, ...result }
  })

  app.post('/api/auth/device/approve', { preHandler: authMiddleware }, async (request, reply) => {
    const { userCode } = request.body ?? {}
    if (!userCode) return reply.code(400).send({ error: 'userCode required' })
    try {
      await approveDeviceAuth(String(userCode).trim().toUpperCase(), request.user.id)
      const account = await resolveAccountForEmail(request.user.id)
      let verificationEmailSent = false
      if (!account.emailVerified) {
        try {
          await sendVerificationEmailForAccount(account)
          verificationEmailSent = true
        } catch {
          // device link still succeeds; user can resend from website or desktop
        }
      }
      return {
        ok: true,
        verificationEmailSent,
        accountEmail: account.email
      }
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Approval failed' })
    }
  })

  app.post('/api/auth/forgot-password', async (request, reply) => {
    const email = normalizeAccountEmail(request.body?.email)
    if (!email) return reply.code(400).send({ error: 'Email is required' })
    const account = await findAccountByEmail(email)
    if (account) {
      const rate = await checkRateLimit(account.id, 'public:password_reset', 10 * 60 * 1000, null, request.ip)
      if (rate.allowed) {
        try {
          await sendPasswordResetEmailForAccount(account)
          await recordRateLimit(account.id, 'public:password_reset', null, request.ip)
          await logEmailAudit({
            userId: account.id,
            event: 'public:password_reset',
            ip: request.ip,
            rateLimited: false,
            success: true
          })
        } catch (error) {
          console.error('[registry-email] public password_reset send failed', {
            error: error instanceof Error ? error.message : String(error)
          })
          await logEmailAudit({
            userId: account.id,
            event: 'public:password_reset',
            ip: request.ip,
            rateLimited: false,
            success: false,
            errorCode: error instanceof Error ? error.message : 'send_failed'
          })
        }
      }
    }
    return { ok: true, message: GENERIC_ACCOUNT_EMAIL_MESSAGE }
  })

  app.post('/api/auth/resend-verification', async (request, reply) => {
    const email = normalizeAccountEmail(request.body?.email)
    if (!email) return reply.code(400).send({ error: 'Email is required' })
    const account = await findAccountByEmail(email)
    if (account && !account.emailVerified) {
      const rate = await checkRateLimit(account.id, 'public:resend_verification', 5 * 60 * 1000, null, request.ip)
      if (rate.allowed) {
        try {
          await sendVerificationEmailForAccount(account)
          await recordRateLimit(account.id, 'public:resend_verification', null, request.ip)
          await logEmailAudit({
            userId: account.id,
            event: 'public:resend_verification',
            ip: request.ip,
            rateLimited: false,
            success: true
          })
        } catch (error) {
          console.error('[registry-email] public resend_verification send failed', {
            error: error instanceof Error ? error.message : String(error)
          })
          await logEmailAudit({
            userId: account.id,
            event: 'public:resend_verification',
            ip: request.ip,
            rateLimited: false,
            success: false,
            errorCode: error instanceof Error ? error.message : 'send_failed'
          })
        }
      }
    }
    return { ok: true, message: GENERIC_ACCOUNT_EMAIL_MESSAGE }
  })

  app.post('/api/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body ?? {}
    if (!refreshToken) return reply.code(400).send({ error: 'refreshToken required' })
    try {
      const result = await refreshAccessToken(refreshToken)
      return { ok: true, ...result }
    } catch {
      return reply.code(401).send({ error: 'Invalid refresh token' })
    }
  })

  app.post('/api/auth/logout', async (request) => {
    const { refreshToken } = request.body ?? {}
    if (refreshToken) await revokeRefreshToken(refreshToken)
    return { ok: true }
  })

  app.get('/api/auth/me', { preHandler: authMiddleware }, async (request) => {
    return { ok: true, user: request.user }
  })
}

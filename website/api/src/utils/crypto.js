/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { config } from '../config.js'

const encoder = new TextEncoder()

function jwtKey() {
  return encoder.encode(config.jwtSecret)
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  const check = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'))
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function signAccessToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${config.jwtAccessTtlSec}s`)
    .sign(jwtKey())
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, jwtKey())
  return payload
}

export function generateDeviceCodes() {
  const deviceCode = crypto.randomBytes(32).toString('base64url')
  const chars = 'BCDFGHJKLMNPQRSTVWXYZ23456789'
  let userCode = ''
  for (let i = 0; i < 8; i += 1) {
    if (i === 4) userCode += '-'
    userCode += chars[crypto.randomInt(chars.length)]
  }
  return { deviceCode, userCode }
}

/** @param {string} raw */
export function normalizeDeviceUserCode(raw) {
  const alnum = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (alnum.length !== 8) return null
  return `${alnum.slice(0, 4)}-${alnum.slice(4)}`
}

export function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Sign verified lab manifest checksum with Ed25519 if key configured.
 * @param {string} checksumHex
 */
export function signLabChecksum(checksumHex) {
  if (!config.labSigningPrivateKey) return null
  try {
    const key = crypto.createPrivateKey(config.labSigningPrivateKey.replace(/\\n/g, '\n'))
    const sig = crypto.sign(null, Buffer.from(checksumHex, 'utf8'), key)
    return sig.toString('base64')
  } catch {
    return null
  }
}

/**
 * @param {string} checksumHex
 * @param {string} signatureBase64
 */
export function verifyLabSignature(checksumHex, signatureBase64) {
  if (!config.labSigningPublicKey || !signatureBase64) return false
  try {
    const key = crypto.createPublicKey(config.labSigningPublicKey.replace(/\\n/g, '\n'))
    return crypto.verify(null, Buffer.from(checksumHex, 'utf8'), key, Buffer.from(signatureBase64, 'base64'))
  } catch {
    return false
  }
}

export function createCompletionProof(payload) {
  const body = JSON.stringify(payload)
  return crypto.createHmac('sha256', config.jwtSecret).update(body).digest('hex')
}

export function verifyCompletionProof(payload, proof) {
  return createCompletionProof(payload) === proof
}

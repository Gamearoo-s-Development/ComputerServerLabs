/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { clearLabCache } from '../labManager.js'
import { assertLabSafety } from '../utils/sanitize.js'
import { getOnlineLabsRoot } from '../utils/paths.js'
import { logger } from '../utils/logger.js'

/**
 * Install-time checks for registry packs (curated on the server — no strict schema / Dockerfile heuristics).
 * @param {object} lab
 */
function validateRegistryInstallLab(lab) {
  if (!lab || typeof lab !== 'object' || Array.isArray(lab)) {
    return { ok: false, message: 'lab.json must be a JSON object' }
  }
  if (!lab.id || typeof lab.id !== 'string') {
    return { ok: false, message: 'lab.json must include a string id' }
  }
  if (lab.credentials?.password) {
    return { ok: false, message: 'Hardcoded credentials.password is not allowed' }
  }
  const runtime = lab.runtime ?? 'docker'
  if (runtime !== 'docker') {
    return { ok: false, message: `Unsupported runtime "${runtime}"` }
  }
  if (!lab.docker) {
    return { ok: false, message: 'Docker runtime requires a docker block' }
  }
  if (lab.docker?.privileged === true) {
    return { ok: false, message: 'Privileged containers are not allowed' }
  }
  try {
    assertLabSafety(lab)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
  return { ok: true }
}

/**
 * Verify Ed25519 signature when public key is configured on server and returned to client.
 * @param {string} checksumHex
 * @param {string | null} signatureBase64
 * @param {string | null} publicKeyPem
 */
export function verifyLabPackSignature(checksumHex, signatureBase64, publicKeyPem) {
  if (!signatureBase64 || !publicKeyPem) return false
  try {
    const key = crypto.createPublicKey(publicKeyPem.replace(/\\n/g, '\n'))
    return crypto.verify(null, Buffer.from(checksumHex, 'utf8'), key, Buffer.from(signatureBase64, 'base64'))
  } catch {
    return false
  }
}

/**
 * @param {Buffer} zipBuffer
 * @param {{ expectedChecksum?: string, signature?: string | null, signatureValid?: boolean, badges?: string[] }} meta
 */
export function verifyLabPack(zipBuffer, meta = {}) {
  const checksum = crypto.createHash('sha256').update(zipBuffer).digest('hex')
  if (meta.expectedChecksum && checksum !== meta.expectedChecksum) {
    return { ok: false, stage: 'checksum', message: 'Lab pack checksum mismatch', checksum }
  }

  const packBadges = meta.badges ?? []
  const hasSignature = Boolean(meta.signature)
  const signatureOk = !hasSignature || meta.signatureValid === true

  if (hasSignature && !signatureOk) {
    return {
      ok: false,
      stage: 'signature',
      message: 'Lab pack signature check failed',
      checksum,
      verified: false
    }
  }

  const zip = new AdmZip(zipBuffer)
  const labEntry = zip.getEntries().find((e) => e.entryName.endsWith('lab.json') && !e.isDirectory)
  if (!labEntry) {
    return { ok: false, stage: 'schema', message: 'lab.json missing from pack', checksum }
  }

  let lab
  try {
    lab = JSON.parse(labEntry.getData().toString('utf8'))
  } catch {
    return { ok: false, stage: 'schema', message: 'lab.json is not valid JSON', checksum }
  }

  const installCheck = validateRegistryInstallLab(lab)
  if (!installCheck.ok) {
    return {
      ok: false,
      stage: 'validation',
      message: installCheck.message ?? 'Lab validation failed',
      checksum
    }
  }

  const isVerifiedBadge =
    packBadges.includes('verified') ||
    packBadges.includes('official') ||
    packBadges.includes('bundled') ||
    packBadges.includes('catalog-only')
  const trustLevel = signatureOk && isVerifiedBadge && hasSignature ? 'verified' : 'community'
  const requiresConfirmation = false

  return {
    ok: true,
    checksum,
    verified: trustLevel === 'verified',
    trustLevel,
    requiresConfirmation,
    warning: isVerifiedBadge && !hasSignature
      ? 'This lab is not cryptographically signed. Review files before running if you did not publish it yourself.'
      : null,
    lab,
    badges: packBadges.length ? packBadges : (lab.badges ?? [])
  }
}

/**
 * @param {AdmZip} zip
 * @param {string} labId
 */
function resolvePackInstallLayout(zip, labId) {
  const entries = zip
    .getEntries()
    .filter((e) => !e.isDirectory)
    .map((e) => e.entryName.replace(/\\/g, '/'))

  const hasNestedLab = entries.some((n) => n === `${labId}/lab.json`)
  const hasFlatLab = entries.some((n) => n === 'lab.json')
  const hasCommon = entries.some((n) => n.startsWith('common/'))

  if (hasNestedLab && (hasCommon || !hasFlatLab)) {
    return 'labs-root'
  }
  return 'lab-folder'
}

/**
 * Extract verified lab pack to userData/online-labs (labs-root layout) or online-labs/<labId> (flat pack).
 * @param {Buffer} zipBuffer
 * @param {string} labId
 */
export function installLabPack(zipBuffer, labId) {
  const onlineRoot = getOnlineLabsRoot()
  fs.mkdirSync(onlineRoot, { recursive: true })

  const zip = new AdmZip(zipBuffer)
  const layout = resolvePackInstallLayout(zip, labId)

  let installDir
  if (layout === 'labs-root') {
    fs.rmSync(path.join(onlineRoot, labId), { recursive: true, force: true })
    zip.extractAllTo(onlineRoot, true)
    installDir = path.join(onlineRoot, labId)
  } else {
    installDir = path.join(onlineRoot, labId)
    fs.rmSync(installDir, { recursive: true, force: true })
    fs.mkdirSync(installDir, { recursive: true })
    zip.extractAllTo(installDir, true)
  }

  if (!fs.existsSync(path.join(installDir, 'lab.json'))) {
    fs.rmSync(installDir, { recursive: true, force: true })
    throw new Error(`Installed pack is missing ${labId}/lab.json`)
  }

  const metaPath = path.join(onlineRoot, `${labId}.meta.json`)
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      { labId, installedAt: new Date().toISOString(), source: 'online-registry', packLayout: layout },
      null,
      2
    )
  )

  logger.info('onlineLabRegistry', 'Installed online lab', { labId, installDir, layout })
  return { labId, installPath: installDir, packLayout: layout }
}

/**
 * Remove a registry-downloaded lab from userData/online-labs (not bundled app/labs).
 * @param {string} labId
 */
export function uninstallOnlineLab(labId) {
  const id = String(labId ?? '').trim()
  if (!id) throw new Error('Lab id required')

  const root = getOnlineLabsRoot()
  const installDir = path.join(root, id)
  const labJson = path.join(installDir, 'lab.json')
  if (!fs.existsSync(labJson)) {
    throw new Error('This lab is not installed from the online registry')
  }

  fs.rmSync(installDir, { recursive: true, force: true })
  const metaPath = path.join(root, `${id}.meta.json`)
  if (fs.existsSync(metaPath)) fs.rmSync(metaPath, { force: true })

  clearLabCache()
  logger.info('onlineLabRegistry', 'Uninstalled online lab', { labId: id })
  return { labId: id, uninstalled: true }
}

/**
 * Install a local .zip lab pack (sideload / downloaded file).
 * @param {Buffer} zipBuffer
 * @param {{ confirmUnverified?: boolean }} [options]
 */
export function importLocalLabPack(zipBuffer, options = {}) {
  const verification = verifyLabPack(zipBuffer, {})
  if (!verification.ok) {
    throw new Error(verification.message ?? 'Lab pack verification failed')
  }

  const labId = verification.lab?.id
  if (!labId || typeof labId !== 'string') {
    throw new Error('lab.json must include a string id')
  }

  if (
    !options.confirmUnverified &&
    (!verification.verified || verification.trustLevel !== 'verified')
  ) {
    return {
      ok: false,
      needsConfirmation: true,
      labId,
      warning:
        verification.warning ??
        'Only import lab packs from sources you trust. Review files before deploying.',
      trustLevel: verification.trustLevel,
      verification
    }
  }

  const installed = installLabPack(zipBuffer, labId)
  clearLabCache()

  logger.info('onlineLabRegistry', 'Lab imported from local pack', {
    labId,
    installPath: installed.installPath,
    trustLevel: verification.trustLevel
  })

  return {
    ok: true,
    labId,
    installPath: installed.installPath,
    verified: verification.verified,
    trustLevel: verification.trustLevel,
    warning: verification.warning,
    checksum: verification.checksum
  }
}

export function listInstalledOnlineLabs() {
  const root = getOnlineLabsRoot()
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => fs.existsSync(path.join(root, d.name, 'lab.json')))
    .map((d) => {
      const metaPath = path.join(root, `${d.name}.meta.json`)
      const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {}
      return { labId: d.name, ...meta }
    })
}

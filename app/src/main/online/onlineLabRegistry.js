/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { clearLabCache } from '../labManager.js'
import { getDeviceId, getOnlineRegistryBaseUrl, onlineFetch } from './onlineApiClient.js'
import { getOnlineAccessToken } from './onlineTokenStore.js'
import {
  installLabPack,
  listInstalledOnlineLabs,
  uninstallOnlineLab,
  verifyLabPack
} from './labPackVerifier.js'
import { logger } from '../utils/logger.js'

export async function browseOnlineLabs(filters = {}) {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.difficulty) params.set('difficulty', filters.difficulty)
  if (filters.runtime) params.set('runtime', filters.runtime)
  if (filters.badge) params.set('badge', filters.badge)
  if (filters.q) params.set('q', filters.q)
  const res = await onlineFetch(`/api/labs?${params}`, { auth: false })
  const installed = new Set(listInstalledOnlineLabs().map((l) => l.labId))
  return (res.labs ?? []).map((lab) => ({
    ...lab,
    installed: installed.has(lab.id)
  }))
}

/**
 * @param {string} labId
 */
async function fetchLabPackJson(labId) {
  const candidates = [`${labId}/lab.json`, 'lab.json']
  for (const filePath of candidates) {
    try {
      const res = await onlineFetch(
        `/api/labs/${encodeURIComponent(labId)}/source/file?path=${encodeURIComponent(filePath)}`,
        { auth: false }
      )
      if (res?.file?.content) {
        return JSON.parse(res.file.content)
      }
    } catch {
      // try next path layout
    }
  }
  return null
}

/**
 * @param {string} labId
 */
async function fetchLabSourceSummary(labId) {
  try {
    const res = await onlineFetch(`/api/labs/${encodeURIComponent(labId)}/source`, { auth: false })
    const files = res?.files ?? []
    return {
      totalFiles: res?.totalFiles ?? files.length,
      viewableFiles: files.filter((f) => f.viewable).length,
      version: res?.version ?? null
    }
  } catch {
    return null
  }
}

export async function getOnlineLabDetail(labId) {
  const installed = listInstalledOnlineLabs().find((entry) => entry.labId === labId) ?? null
  const [labRes, checksumRes, sigRes, packJson, sourceSummary] = await Promise.all([
    onlineFetch(`/api/labs/${encodeURIComponent(labId)}`, { auth: false }),
    onlineFetch(`/api/labs/${encodeURIComponent(labId)}/checksum`, { auth: false }).catch(() => null),
    onlineFetch(`/api/labs/${encodeURIComponent(labId)}/signature`, { auth: false }).catch(() => null),
    fetchLabPackJson(labId).catch(() => null),
    fetchLabSourceSummary(labId).catch(() => null)
  ])
  return {
    lab: labRes.lab,
    checksum: checksumRes,
    signature: sigRes,
    packMeta: packJson
      ? {
          tasks: packJson.tasks ?? [],
          objectivesPublic: packJson.objectivesPublic ?? [],
          xpReward: packJson.xpReward ?? null,
          labMode: packJson.labMode ?? null,
          tags: packJson.tags ?? [],
          unlockRequirements: packJson.unlockRequirements ?? null
        }
      : null,
    sourceSummary,
    installed
  }
}

/**
 * Download, verify, and install a lab pack.
 * @param {string} labId
 * @param {{ confirmUnverified?: boolean }} [options]
 */
export async function downloadAndInstallLab(labId, options = {}) {
  const detail = await getOnlineLabDetail(labId)
  const lab = detail.lab
  if (!lab?.latestVersion) throw new Error('No downloadable version for this lab')

  const apiBase = getOnlineRegistryBaseUrl()
  const token = getOnlineAccessToken()

  const res = await fetch(`${apiBase}/api/labs/${labId}/download`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Device-Id': getDeviceId()
    }
  })

  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const zipBuffer = Buffer.from(await res.arrayBuffer())
  const headerChecksum = res.headers.get('x-lab-checksum-sha256')?.trim() || null

  const verification = verifyLabPack(zipBuffer, {
    expectedChecksum:
      headerChecksum ??
      detail.checksum?.checksumSha256 ??
      lab.latestVersion.checksumSha256,
    signature: detail.signature?.signature ?? null,
    signatureValid: detail.signature?.signatureValid === true,
    badges: lab.badges ?? []
  })

  if (!verification.ok) {
    throw new Error(verification.message ?? 'Lab pack verification failed')
  }

  if (verification.requiresConfirmation && !options.confirmUnverified) {
    return {
      ok: false,
      needsConfirmation: true,
      warning: verification.warning,
      trustLevel: verification.trustLevel,
      verification
    }
  }

  const installed = installLabPack(zipBuffer, labId)
  clearLabCache()

  logger.info('onlineLabRegistry', 'Lab installed from registry', {
    labId,
    verified: verification.verified,
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

export async function reportOnlineLab(labId, reason, details) {
  await onlineFetch(`/api/labs/${labId}/report`, {
    method: 'POST',
    body: { reason, details }
  })
  return { ok: true }
}

export async function uninstallRegistryLab(labId) {
  return uninstallOnlineLab(labId)
}

export { listInstalledOnlineLabs }

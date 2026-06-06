/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import { Button, Modal } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import {
  estimatedMinutesForDifficulty,
  labInitials,
  labThumbnailStyle,
  runtimeIcon
} from '../labs/labBrowserUtils.js'
import { LOCAL_REGISTRY_BASE_URL, WEBSITE_URL } from '@sysadmin-game/shared/branding/appBrand.js'

function LabSourceBadge({ badges = [], isBundled }) {
  if (isBundled) {
    return (
      <span className="rounded-full border border-violet-400/40 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
        Bundled with app
      </span>
    )
  }
  if (badges.includes('catalog-only')) {
    return (
      <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200">
        Catalog download
      </span>
    )
  }
  if (badges.includes('verified') || badges.includes('official')) {
    return (
      <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success">
        Official
      </span>
    )
  }
  if (badges.includes('community') || badges.includes('unverified')) {
    return (
      <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
        Community
      </span>
    )
  }
  return null
}

/**
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   labSummary: object | null
 *   onDownload: (labId: string) => void
 *   onUninstall: (labId: string) => void
 *   downloading?: boolean
 *   uninstalling?: boolean
 * }} props
 */
export default function OnlineLabDetailModal({
  open,
  onClose,
  labSummary,
  onDownload,
  onUninstall,
  downloading = false,
  uninstalling = false
}) {
  const { profile, isDevelopmentUnpackaged } = useAppState()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!labSummary?.id) return
    const api = getApi()
    setLoading(true)
    setError('')
    try {
      const res = await api?.online?.getLab?.(labSummary.id)
      if (res?.ok) {
        setDetail(res.data)
      } else {
        setError(res?.error?.message ?? 'Could not load lab details')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load lab details')
    } finally {
      setLoading(false)
    }
  }, [labSummary?.id])

  useEffect(() => {
    if (!open || !labSummary) {
      setDetail(null)
      setError('')
      return
    }
    void load()
  }, [open, labSummary, labSummary?.installed, load])

  if (!labSummary) return null

  const lab = detail?.lab ?? labSummary
  const packMeta = detail?.packMeta
  const latest = lab?.latestVersion
  const sig = detail?.signature
  const isInstalled = Boolean(labSummary?.installed || detail?.installed)
  const installedMeta =
    detail?.installed && typeof detail.installed === 'object'
      ? detail.installed
      : labSummary?.installed
        ? { labId: labSummary.id }
        : null
  const isBundled = lab?.isBundled === true
  const isCatalogOnly = !isBundled && (lab?.badges ?? []).includes('catalog-only')
  const tasks = packMeta?.tasks ?? []
  const objectives = packMeta?.objectivesPublic ?? []
  const sourceSummary = detail?.sourceSummary

  const openRegistry = () => {
    const api = getApi()
    const base =
      profile?.settings?.onlineWebsiteBaseUrl ??
      profile?.settings?.onlineApiBaseUrl ??
      (isDevelopmentUnpackaged ? LOCAL_REGISTRY_BASE_URL : WEBSITE_URL)
    void api?.app?.openExternal?.(String(base).replace(/\/$/, ''))
  }

  return (
    <Modal open={open} onClose={onClose} title={lab.title ?? labSummary.title} size="lg">
      <div className="max-h-[min(72vh,40rem)] overflow-y-auto">
        <div
          className="relative flex h-24 items-center justify-center border-b border-border/60"
          style={labThumbnailStyle(lab.id ?? labSummary.id, lab.category ?? labSummary.category)}
        >
          <span className="text-3xl font-bold tracking-wide text-white/90 drop-shadow-md">
            {labInitials(lab.title ?? labSummary.title)}
          </span>
          <span className="absolute right-4 top-4 text-2xl opacity-90" title={lab.runtime ?? labSummary.runtime}>
            {runtimeIcon(lab.runtime ?? labSummary.runtime)}
          </span>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <LabSourceBadge badges={lab.badges ?? []} isBundled={isBundled} />
            {(lab.badges ?? [])
              .filter((b) => !['bundled', 'catalog-only', 'official', 'verified'].includes(b))
              .slice(0, 4)
              .map((b) => (
                <span key={b} className="text-[10px] uppercase tracking-wide text-muted-dim">
                  {b.replace(/-/g, ' ')}
                </span>
              ))}
          </div>

          {isBundled ? (
            <p className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-100/90">
              This lab ships inside the desktop installer. Download here for the latest catalog pack or offline use.
            </p>
          ) : null}
          {isCatalogOnly ? (
            <p className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100/90">
              Catalog-only scenario — not in the installer. Download to add it to your local lab list.
            </p>
          ) : null}

          <p className="text-sm leading-relaxed text-muted">{lab.description ?? labSummary.description}</p>

          {loading ? <p className="text-sm text-muted">Loading full details…</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-dim">Difficulty</dt>
              <dd className="font-medium capitalize text-gray-200">{lab.difficulty ?? labSummary.difficulty}</dd>
            </div>
            <div>
              <dt className="text-muted-dim">Category</dt>
              <dd className="font-medium capitalize text-gray-200">{lab.category ?? labSummary.category}</dd>
            </div>
            <div>
              <dt className="text-muted-dim">Runtime</dt>
              <dd className="font-medium text-gray-200">{lab.runtime ?? labSummary.runtime ?? 'docker'}</dd>
            </div>
            <div>
              <dt className="text-muted-dim">Est. time</dt>
              <dd className="font-medium text-gray-200">
                {estimatedMinutesForDifficulty(lab.difficulty ?? labSummary.difficulty)}
              </dd>
            </div>
            {packMeta?.xpReward != null ? (
              <div>
                <dt className="text-muted-dim">XP reward</dt>
                <dd className="font-medium text-gray-200">{packMeta.xpReward}</dd>
              </div>
            ) : null}
            {lab.downloadCount != null ? (
              <div>
                <dt className="text-muted-dim">Downloads</dt>
                <dd className="font-medium text-gray-200">{lab.downloadCount}</dd>
              </div>
            ) : null}
          </dl>

          {lab.creatorName ? (
            <p className="text-xs text-muted">
              Published by <span className="text-gray-300">{lab.creatorName}</span>
            </p>
          ) : null}

          {latest ? (
            <section className="rounded-lg border border-border/70 bg-background/40 p-3 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Pack version</h3>
              <p className="mt-1 text-gray-200">
                <strong>{latest.version}</strong>
                {latest.publishedAt ? (
                  <span className="text-muted"> · published {new Date(latest.publishedAt).toLocaleDateString()}</span>
                ) : null}
              </p>
              {latest.changelog ? <p className="mt-2 text-muted-dim">{latest.changelog}</p> : null}
              {latest.checksumSha256 ? (
                <p className="mt-2 break-all font-mono text-[10px] text-muted-dim">
                  SHA-256: {latest.checksumSha256}
                </p>
              ) : null}
              {sig ? (
                <p className="mt-1 text-xs text-muted-dim">
                  Signature:{' '}
                  {sig.signingOptional
                    ? 'optional (unsigned pack)'
                    : sig.signatureValid
                      ? 'verified'
                      : 'present but not verified'}
                </p>
              ) : null}
              {sourceSummary ? (
                <p className="mt-1 text-xs text-muted-dim">
                  Source pack: {sourceSummary.viewableFiles} viewable file
                  {sourceSummary.viewableFiles === 1 ? '' : 's'}
                  {sourceSummary.totalFiles > sourceSummary.viewableFiles
                    ? ` (${sourceSummary.totalFiles} total in archive)`
                    : ''}
                </p>
              ) : null}
            </section>
          ) : null}

          {isInstalled ? (
            <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
              <strong>Installed locally</strong>
              {installedMeta?.installedAt
                ? ` · ${new Date(installedMeta.installedAt).toLocaleString()}`
                : ''}
              {installedMeta?.packLayout ? ` · layout: ${installedMeta.packLayout}` : ''}
            </p>
          ) : null}

          {tasks.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Tasks</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
                {tasks.map((task, i) => (
                  <li key={i}>{task}</li>
                ))}
              </ol>
            </section>
          ) : null}

          {objectives.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Objectives</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {objectives.map((obj) => (
                  <li key={obj.id ?? obj.label} className="rounded-md border border-border/50 bg-background/30 px-3 py-2">
                    <p className="font-medium text-gray-200">{obj.label ?? obj.id}</p>
                    {obj.text ? <p className="mt-1 text-muted-dim">{obj.text}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {(lab.reviews ?? []).length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Reviews</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-dim">
                {lab.reviews.slice(0, 3).map((review, i) => (
                  <li key={i} className="border-l-2 border-border pl-3">
                    <span className="text-warning">{'★'.repeat(review.rating ?? 0)}</span>
                    {review.display_name ? ` · ${review.display_name}` : ''}
                    {review.body ? <p className="mt-1">{review.body}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
            {isInstalled ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={uninstalling || downloading}
                  onClick={() => onUninstall(lab.id ?? labSummary.id)}
                >
                  {uninstalling ? 'Removing…' : 'Uninstall'}
                </Button>
                <Button size="sm" disabled={downloading || uninstalling} onClick={() => onDownload(lab.id ?? labSummary.id)}>
                  {downloading ? 'Updating…' : 'Update pack'}
                </Button>
              </>
            ) : (
              <Button size="sm" disabled={downloading || uninstalling} onClick={() => onDownload(lab.id ?? labSummary.id)}>
                {downloading ? 'Downloading…' : 'Download pack'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => openRegistry()}>
              Open registry site
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

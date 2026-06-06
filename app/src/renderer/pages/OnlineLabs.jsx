/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '../components/ui/index.js'
import OnlineLabDetailModal from '../components/online/OnlineLabDetailModal.jsx'
import { getApi } from '../hooks/useApi.js'
import { useNotifications } from '../context/NotificationContext.jsx'

const REGISTRY_CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'linux', label: 'Linux' },
  { value: 'networking', label: 'Networking' },
  { value: 'containers', label: 'Containers' },
  { value: 'web', label: 'Web services' },
  { value: 'storage', label: 'Storage & databases' },
  { value: 'security', label: 'Security' },
  { value: 'general', label: 'General' }
]

function TrustBadge({ badges = [], isBundled }) {
  if (isBundled) {
    return (
      <span className="rounded-full border border-violet-400/40 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
        Bundled
      </span>
    )
  }
  if (badges.includes('catalog-only')) {
    return (
      <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200">
        Catalog
      </span>
    )
  }
  if (badges.includes('verified') || badges.includes('official')) {
    return <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success">Verified</span>
  }
  if (badges.includes('unverified') || badges.includes('community')) {
    return <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">Community</span>
  }
  return null
}

export default function OnlineLabs() {
  const { notify } = useNotifications()
  const [labs, setLabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [category, setCategory] = useState('')
  const [badge, setBadge] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState(null)
  const [selectedLab, setSelectedLab] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [uninstallingId, setUninstallingId] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(timer)
  }, [q])

  const load = useCallback(async () => {
    const api = getApi()
    setLoading(true)
    try {
      const res = await api?.online?.browseLabs?.({
        q: debouncedQ,
        category,
        badge: badge || undefined
      })
      if (res?.ok) setLabs(res.data?.labs ?? [])
    } catch (e) {
      notify({ title: 'Online labs unavailable', body: String(e), tone: 'warning' })
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, category, badge, notify])

  useEffect(() => {
    void load()
  }, [load])

  const download = useCallback(
    async (labId, confirmUnverified = false) => {
      const api = getApi()
      setDownloadingId(labId)
      try {
        const res = await api?.online?.downloadLab?.({ labId, confirmUnverified })
        if (res?.data?.needsConfirmation) {
          setPendingConfirm({ labId, warning: res.data.warning })
          return
        }
        if (res?.ok) {
          notify({
            title: res.data?.verified ? 'Verified lab installed' : 'Lab installed',
            body: res.data?.warning ?? `${labId} is ready in your local lab list.`,
            tone: res.data?.verified ? 'success' : 'warning'
          })
          setPendingConfirm(null)
          setLabs((prev) => prev.map((l) => (l.id === labId ? { ...l, installed: true } : l)))
          if (selectedLab?.id === labId) {
            setSelectedLab((prev) => (prev ? { ...prev, installed: true } : prev))
          }
          void load()
        } else {
          notify({ title: 'Download failed', body: res?.error?.message ?? 'Unknown error', tone: 'danger' })
        }
      } catch (e) {
        notify({ title: 'Download failed', body: String(e), tone: 'danger' })
      } finally {
        setDownloadingId(null)
      }
    },
    [notify, selectedLab?.id]
  )

  const uninstall = useCallback(
    async (labId) => {
      const api = getApi()
      setUninstallingId(labId)
      try {
        const res = await api?.online?.uninstallLab?.(labId)
        if (res?.ok) {
          notify({
            title: 'Lab removed',
            body: `${labId} was uninstalled from your local library. Bundled labs in the app installer are unchanged.`,
            tone: 'success'
          })
          setLabs((prev) => prev.map((l) => (l.id === labId ? { ...l, installed: false } : l)))
          if (selectedLab?.id === labId) {
            setSelectedLab((prev) => (prev ? { ...prev, installed: false } : prev))
          }
          void load()
        } else {
          notify({ title: 'Uninstall failed', body: res?.error?.message ?? 'Unknown error', tone: 'danger' })
        }
      } catch (e) {
        notify({ title: 'Uninstall failed', body: String(e), tone: 'danger' })
      } finally {
        setUninstallingId(null)
      }
    },
    [load, notify, selectedLab?.id]
  )

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold text-white">Online Labs</h1>
        <p className="text-sm text-muted">
          Browse the public registry, read full lab details, and download packs into your local lab library.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <input
          className="rounded-md border border-border bg-background-elevated px-3 py-2 text-sm"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-md border border-border bg-background-elevated px-3 py-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {REGISTRY_CATEGORIES.map((c) => (
            <option key={c.value || 'all'} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background-elevated px-3 py-2 text-sm"
          value={badge}
          onChange={(e) => setBadge(e.target.value)}
        >
          <option value="">All sources</option>
          <option value="bundled">Bundled with app</option>
          <option value="catalog-only">Catalog download only</option>
          <option value="community">Community examples</option>
        </select>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {pendingConfirm ? (
        <section className="rounded-lg border border-warning/50 bg-warning/10 p-4">
          <p className="text-sm text-warning">{pendingConfirm.warning}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void download(pendingConfirm.labId, true)}>
              I understand — install anyway
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPendingConfirm(null)}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      {loading ? <p className="text-muted">Loading registry…</p> : null}

      {!loading ? (
        <p className="text-xs text-muted-dim">
          {labs.length} lab{labs.length === 1 ? '' : 's'} in registry
          {debouncedQ ? ` · search: “${debouncedQ}”` : ''}
        </p>
      ) : null}

      {!loading && labs.length === 0 ? (
        <p className="text-sm text-muted">No labs match your filters.</p>
      ) : null}

      <ul className="grid auto-rows-fr items-stretch gap-3 md:grid-cols-2">
        {labs.map((lab) => (
          <li key={lab.id} className="flex min-h-0 min-w-0">
            <div className="flex h-full w-full flex-col rounded-lg border border-border bg-background-elevated/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium text-white">{lab.title}</h2>
              <TrustBadge badges={lab.badges} isBundled={lab.isBundled} />
            </div>
            <p className="mt-1 text-xs text-muted capitalize">
              {lab.difficulty} · {lab.category} · {lab.runtime ?? 'docker'}
            </p>
            <p className="mt-2 line-clamp-2 text-sm text-muted-dim">{lab.description}</p>
            {lab.latestVersion ? (
              <p className="mt-2 text-[10px] text-muted-dim">
                Pack v{lab.latestVersion.version}
                {lab.downloadCount != null ? ` · ${lab.downloadCount} downloads` : ''}
              </p>
            ) : null}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
              <Button size="sm" variant="ghost" onClick={() => setSelectedLab(lab)}>
                Details
              </Button>
              {lab.installed ? (
                <>
                  <span className="rounded-md border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                    Installed
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={uninstallingId === lab.id || downloadingId === lab.id}
                    onClick={() => void uninstall(lab.id)}
                  >
                    {uninstallingId === lab.id ? 'Removing…' : 'Uninstall'}
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      !lab.latestVersion || downloadingId === lab.id || uninstallingId === lab.id
                    }
                    onClick={() => void download(lab.id)}
                  >
                    {downloadingId === lab.id ? 'Updating…' : 'Update'}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  disabled={!lab.latestVersion || downloadingId === lab.id}
                  title={!lab.latestVersion ? 'No downloadable pack yet' : undefined}
                  onClick={() => void download(lab.id)}
                >
                  {downloadingId === lab.id ? 'Downloading…' : lab.latestVersion ? 'Download' : 'Pack not published'}
                </Button>
              )}
            </div>
            </div>
          </li>
        ))}
      </ul>

      <OnlineLabDetailModal
        open={Boolean(selectedLab)}
        labSummary={selectedLab}
        onClose={() => setSelectedLab(null)}
        onDownload={(labId) => void download(labId)}
        onUninstall={(labId) => void uninstall(labId)}
        downloading={Boolean(selectedLab && downloadingId === selectedLab.id)}
        uninstalling={Boolean(selectedLab && uninstallingId === selectedLab.id)}
      />
    </div>
  )
}

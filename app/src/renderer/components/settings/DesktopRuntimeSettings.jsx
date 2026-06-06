/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { Button, StatusBadge } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { useNotifications } from '../../context/NotificationContext.jsx'
import WorkstationDockerStatusPanel from '../workstation/WorkstationDockerStatusPanel.jsx'
import { cn } from '../../utils/cn.js'

/**
 * @param {{ status?: string }} props
 */
function statusVariant(status) {
  if (status === 'available') return 'success'
  if (status === 'unavailable') return 'danger'
  return 'warning'
}

/**
 * @param {{ runtime: object, onRefresh: () => void }} props
 */
function ConfigureDesktopRuntimeModal({ runtime, open, onClose, onSaved }) {
  const { notify } = useNotifications()
  const [image, setImage] = useState(runtime?.image ?? '')
  const [trusted, setTrusted] = useState(runtime?.trusted === true)
  const [enabled, setEnabled] = useState(runtime?.enabled !== false)
  const [busy, setBusy] = useState(false)
  const [trustInfo, setTrustInfo] = useState(null)

  useEffect(() => {
    if (!open || !runtime) return
    setImage(runtime.image ?? '')
    setTrusted(runtime.trusted === true)
    setEnabled(runtime.enabled !== false)
    const api = getApi()
    void api?.labBuilder?.classifyDockerImage?.({ image: runtime.image ?? '' }).then((res) => {
      if (res?.ok) setTrustInfo(res.data)
    })
  }, [open, runtime])

  useEffect(() => {
    if (!open) return
    const api = getApi()
    void api?.labBuilder?.classifyDockerImage?.({ image }).then((res) => {
      if (res?.ok) setTrustInfo(res.data)
    })
  }, [image, open])

  const save = useCallback(async () => {
    const api = getApi()
    if (!api?.desktopRuntime?.save || !runtime?.key) return
    setBusy(true)
    try {
      const res = await api.desktopRuntime.save({
        key: runtime.key,
        image: image.trim(),
        enabled,
        trusted,
        registrySource: trustInfo?.registry ?? null
      })
      if (res?.ok) {
        notify({ title: 'Saved', body: `${runtime.name} image configuration saved.`, tone: 'success' })
        onSaved?.()
        onClose()
      } else {
        notify({ title: 'Save failed', body: res?.error?.message ?? 'Unknown error', tone: 'danger' })
      }
    } finally {
      setBusy(false)
    }
  }, [runtime, image, enabled, trusted, trustInfo, notify, onSaved, onClose])

  const testPull = useCallback(async () => {
    const api = getApi()
    if (!api?.desktopRuntime?.test || !runtime?.key) return
    setBusy(true)
    try {
      const res = await api.desktopRuntime.test({
        key: runtime.key,
        image: image.trim(),
        pullOnly: true
      })
      notify({
        title: res?.ok && res.data?.ok ? 'Pull succeeded' : 'Pull failed',
        body: res?.data?.message ?? res?.error?.message ?? 'Done',
        tone: res?.ok && res.data?.ok ? 'success' : 'warning'
      })
      if (res?.ok) onSaved?.()
    } finally {
      setBusy(false)
    }
  }, [runtime, image, notify, onSaved])

  if (!runtime) return null

  return (
    <Modal open={open} onClose={onClose} title={`Configure ${runtime.name}`} size="lg">
      <div className="space-y-4 px-6 py-5">
        <p className="text-xs text-muted">
          Community and third-party desktop images run with elevated privileges (KVM/QEMU). Only trust
          images you have reviewed.
        </p>

        <label className="block text-sm">
          <span className="text-xs text-muted">Docker image</span>
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="e.g. lscr.io/linuxserver/webtop:ubuntu-kde"
            className="mt-1 w-full rounded-lg border border-border bg-background-elevated px-3 py-2 font-mono text-sm text-white"
          />
        </label>

        {trustInfo ? (
          <p className="text-[11px] text-muted">
            Registry: <span className="font-mono text-gray-300">{trustInfo.registry}</span> · Trust:{' '}
            <span className="text-warning">{trustInfo.badgeLabel}</span>
          </p>
        ) : null}

        <div>
          <p className="text-xs font-medium text-muted-dim">Recommended presets (community)</p>
          <ul className="mt-2 space-y-2">
            {(runtime.presets ?? []).map((preset) => (
              <li key={preset.id} className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-gray-200">{preset.label}</p>
                    <p className="font-mono text-[10px] text-muted-dim">{preset.image}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setImage(preset.image)}>
                    Use preset
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-dim">{preset.trustNote}</p>
              </li>
            ))}
          </ul>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-1 rounded border-border"
          />
          <span>
            <span className="text-gray-200">Enable this desktop runtime</span>
            <span className="mt-1 block text-xs text-muted">Disabled runtimes are hidden from lab workstation selection.</span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={trusted}
            onChange={(e) => setTrusted(e.target.checked)}
            className="mt-1 rounded border-border"
          />
          <span>
            <span className="text-gray-200">I trust this image for desktop labs</span>
            <span className="mt-1 block text-xs text-muted">
              Does not bypass Docker/KVM requirements — records your trust choice only.
            </span>
          </span>
        </label>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="secondary" size="sm" disabled={busy || !image.trim()} onClick={() => void testPull()}>
          Test pull
        </Button>
        <Button variant="primary" size="sm" disabled={busy || !image.trim()} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </Modal>
  )
}

export default function DesktopRuntimeSettings() {
  const { notify } = useNotifications()
  const [runtimes, setRuntimes] = useState([])
  const [environment, setEnvironment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [testingKey, setTestingKey] = useState(null)
  const [configureRuntime, setConfigureRuntime] = useState(null)

  const load = useCallback(async () => {
    const api = getApi()
    setLoading(true)
    try {
      const res = await api?.desktopRuntime?.list?.()
      if (res?.ok) {
        setRuntimes(res.data?.runtimes ?? [])
        setEnvironment(res.data?.capabilities ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const testRuntime = useCallback(
    async (key) => {
      const api = getApi()
      if (!api?.desktopRuntime?.test) return
      setTestingKey(key)
      try {
        const res = await api.desktopRuntime.test({ key })
        if (res?.ok) {
          notify({
            title: res.data?.ok ? 'Desktop runtime test passed' : 'Desktop runtime test failed',
            body: res.data?.message ?? res?.error?.message ?? 'Test complete',
            tone: res.data?.ok ? 'success' : 'warning'
          })
          await load()
        } else {
          notify({ title: 'Test failed', body: res?.error?.message ?? 'Unknown error', tone: 'danger' })
        }
      } finally {
        setTestingKey(null)
      }
    },
    [notify, load]
  )

  return (
    <div className="space-y-4">
      <WorkstationDockerStatusPanel environment={environment} />

      {loading ? <p className="text-xs text-muted">Loading desktop runtimes…</p> : null}

      <ul className="space-y-4">
        {runtimes.map((runtime) => (
          <li
            key={runtime.key}
            className="rounded-lg border border-border/80 bg-background-elevated/40 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">{runtime.name}</h4>
                  <StatusBadge
                    label="Status"
                    value={
                      runtime.status === 'available'
                        ? 'Available'
                        : runtime.status === 'unavailable'
                          ? 'Unavailable'
                          : runtime.image?.trim()
                            ? 'Needs test'
                            : 'Needs Image'
                    }
                    variant={statusVariant(runtime.status)}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">{runtime.resourceHint}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfigureRuntime(runtime)}>
                  Configure Image
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!runtime.image?.trim() || testingKey === runtime.key}
                  onClick={() => void testRuntime(runtime.key)}
                >
                  {testingKey === runtime.key ? 'Testing…' : 'Test Desktop Runtime'}
                </Button>
              </div>
            </div>

            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-dim">Configured image</dt>
                <dd className="mt-0.5 break-all font-mono text-gray-200">
                  {runtime.image?.trim() ? runtime.image : 'Not configured.'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-dim">Image source</dt>
                <dd className="mt-0.5 text-gray-300">{runtime.imageSource ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-dim">Trust level</dt>
                <dd className="mt-0.5 text-gray-300">{runtime.trustLabel ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-dim">Required ports</dt>
                <dd className="mt-0.5 font-mono text-gray-300">
                  {(runtime.requiredPorts ?? []).join(', ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-dim">Pull status</dt>
                <dd className="mt-0.5 text-gray-300">
                  {runtime.pullStatus?.message ?? (runtime.lastTest?.stage === 'pull' ? runtime.lastTest.message : '—')}
                </dd>
              </div>
              <div>
                <dt className="text-muted-dim">Last tested</dt>
                <dd className="mt-0.5 text-gray-300">
                  {runtime.lastTestedAt
                    ? new Date(runtime.lastTestedAt).toLocaleString()
                    : 'Never'}
                </dd>
              </div>
            </dl>

            {runtime.statusReason ? (
              <p
                className={cn(
                  'mt-2 text-[11px]',
                  runtime.status === 'unavailable' ? 'text-danger' : 'text-warning'
                )}
              >
                {runtime.statusReason}
              </p>
            ) : null}

            {runtime.lastTest?.accessRoutes?.length ? (
              <p className="mt-2 text-[10px] text-muted-dim">
                Detected access:{' '}
                {runtime.lastTest.accessRoutes.map((r) => r.label ?? r.type).join(', ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <ConfigureDesktopRuntimeModal
        runtime={configureRuntime}
        open={Boolean(configureRuntime)}
        onClose={() => setConfigureRuntime(null)}
        onSaved={() => void load()}
      />
    </div>
  )
}

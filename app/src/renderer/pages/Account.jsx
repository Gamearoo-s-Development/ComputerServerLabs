/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '../components/ui/index.js'
import LeaderboardProfileCard from '../components/LeaderboardProfileCard.jsx'
import { getApi } from '../hooks/useApi.js'
import { useNotifications } from '../context/NotificationContext.jsx'
import { LOCAL_REGISTRY_BASE_URL, WEBSITE_URL } from '@sysadmin-game/shared/branding/appBrand.js'

export default function Account() {
  const { notify } = useNotifications()
  const [status, setStatus] = useState(null)
  const [notifPrefs, setNotifPrefs] = useState(null)
  const [notifPrefsError, setNotifPrefsError] = useState(null)
  const [notifPrefsLoading, setNotifPrefsLoading] = useState(false)
  const [linkSession, setLinkSession] = useState(null)
  const [linking, setLinking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const [passwordResetUrl, setPasswordResetUrl] = useState(null)
  const [cloudProgress, setCloudProgress] = useState(null)
  const [cloudProgressError, setCloudProgressError] = useState(null)
  const [lastSyncAt, setLastSyncAt] = useState(null)

  const refresh = useCallback(async () => {
    const api = getApi()
    const res = await api?.online?.getStatus?.()
    if (res?.ok) setStatus(res.data)
    const lb = await api?.online?.globalLeaderboard?.()
    if (lb?.ok) setLeaderboard(lb.data?.entries ?? [])
    const resetUrl = await api?.online?.getPasswordResetUrl?.()
    if (resetUrl?.ok) setPasswordResetUrl(resetUrl.data?.url ?? null)
    if (res?.data?.linked) {
      setNotifPrefsLoading(true)
      setNotifPrefsError(null)
      setCloudProgressError(null)
      try {
        const prefs = await api?.online?.getNotificationPreferences?.()
        if (prefs?.ok) {
          setNotifPrefs(prefs.data?.preferences ?? null)
        } else {
          setNotifPrefs(null)
          setNotifPrefsError(prefs?.error?.message ?? 'Could not load notification preferences')
        }
        const cloud = await api?.online?.getCloudProgress?.()
        if (cloud?.ok) {
          setCloudProgress(cloud.data?.progress ?? null)
        } else {
          setCloudProgress(null)
          setCloudProgressError(cloud?.error?.message ?? 'Could not load cloud progress')
        }
      } catch (e) {
        setNotifPrefs(null)
        setNotifPrefsError(String(e))
        setCloudProgress(null)
        setCloudProgressError(String(e))
      } finally {
        setNotifPrefsLoading(false)
      }
    } else {
      setNotifPrefs(null)
      setNotifPrefsError(null)
      setNotifPrefsLoading(false)
      setCloudProgress(null)
      setCloudProgressError(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const startLink = useCallback(async () => {
    const api = getApi()
    setLinking(true)
    try {
      await refresh()
      const res = await api?.online?.deviceLinkStart?.()
      if (!res?.ok) throw new Error(res?.error?.message ?? 'Could not start device link')
      setLinkSession(res.data)
      await api?.online?.openVerificationUrl?.(res.data.verificationUrl)
      const poll = await api?.online?.deviceLinkPoll?.({
        deviceCode: res.data.deviceCode,
        pollIntervalSec: res.data.pollIntervalSec
      })
      if (poll?.ok && poll.data?.linked) {
        notify({ title: 'Account linked', body: `Signed in as ${poll.data.user?.displayName ?? 'player'}`, tone: 'success' })
        setLinkSession(null)
        void refresh()
        const sync = await api?.online?.syncProgress?.()
        if (sync?.ok && !sync?.data?.skipped) {
          setLastSyncAt(new Date().toISOString())
          notify({ title: 'Progress synced', body: 'Existing local progress uploaded to your account.', tone: 'success' })
          void refresh()
        }
      }
    } catch (e) {
      notify({ title: 'Link failed', body: String(e), tone: 'danger' })
    } finally {
      setLinking(false)
    }
  }, [notify, refresh])

  const unlink = useCallback(async () => {
    const api = getApi()
    await api?.online?.unlink?.()
    notify({ title: 'Unlinked', body: 'Local tokens removed.', tone: 'info' })
    void refresh()
  }, [notify, refresh])

  const syncNow = useCallback(async () => {
    const api = getApi()
    setSyncing(true)
    try {
      const res = await api?.online?.syncProgress?.()
      if (res?.data?.skipped) {
        notify({ title: 'Sync skipped', body: res.data.reason, tone: 'info' })
      } else if (res?.ok) {
        setLastSyncAt(new Date().toISOString())
        notify({ title: 'Progress synced', body: 'Cloud progress updated.', tone: 'success' })
        void refresh()
      }
    } catch (e) {
      notify({ title: 'Sync failed', body: String(e), tone: 'danger' })
    } finally {
      setSyncing(false)
    }
  }, [notify])

  const togglePref = useCallback(
    async (key, value) => {
      const api = getApi()
      await api?.online?.updatePreferences?.({ [key]: value })
      void refresh()
    },
    [refresh]
  )

  const toggleNotifPref = useCallback(
    async (key, value) => {
      const api = getApi()
      await api?.online?.updateNotificationPreferences?.({ [key]: value })
      void refresh()
    },
    [refresh]
  )

  const resendVerification = useCallback(async () => {
    const api = getApi()
    setEmailBusy(true)
    try {
      const res = await api?.online?.resendVerification?.()
      if (res?.ok) {
        const to = status?.user?.email ?? 'your account email'
        notify({ title: 'Verification email sent', body: `Check ${to} for the verification link.`, tone: 'success' })
      } else {
        notify({ title: 'Could not send', body: res?.error?.message ?? 'Rate limit or auth error', tone: 'warning' })
      }
    } catch (e) {
      notify({ title: 'Could not send', body: String(e), tone: 'danger' })
    } finally {
      setEmailBusy(false)
    }
  }, [notify])

  const emailPasswordReset = useCallback(async () => {
    const api = getApi()
    setEmailBusy(true)
    try {
      const res = await api?.online?.requestPasswordReset?.()
      if (res?.ok) {
        const to = status?.user?.email ?? 'your account email'
        notify({ title: 'Reset email sent', body: `Check ${to} for the password reset link.`, tone: 'success' })
      } else {
        notify({ title: 'Could not send', body: res?.error?.message ?? 'Try again later', tone: 'warning' })
      }
    } catch (e) {
      notify({ title: 'Could not send', body: String(e), tone: 'danger' })
    } finally {
      setEmailBusy(false)
    }
  }, [notify])

  const openPasswordResetWebsite = useCallback(async () => {
    const api = getApi()
    const url = passwordResetUrl ?? (await api?.online?.getPasswordResetUrl?.())?.data?.url
    if (url) await api?.app?.openExternal?.(url)
  }, [passwordResetUrl])

  const cloudProfile = cloudProgress?.profile ?? null
  const cloudCompletedCount =
    cloudProgress?.labs?.filter((row) => row.completed === 1).length ?? 0

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold text-white">Account &amp; Cloud</h1>
        <p className="text-sm text-muted">
          Link your desktop app to the website with a device code. Passwords stay in the browser — never in this app.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-background-elevated/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-dim">Account linking</h2>
        {status?.linked ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>Signed in as <strong>{status.user?.displayName ?? status.user?.email}</strong></p>
            <p className="text-xs text-muted">API: {status.apiBaseUrl}</p>
            <Button variant="ghost" size="sm" onClick={() => void unlink()}>Unlink account</Button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {status?.apiBaseUrl ? (
              <p className="text-xs text-muted">
                Registry site: <span className="font-mono text-gray-300">{status.apiBaseUrl}</span>
                <span className="text-muted-dim"> (API via /api)</span>
              </p>
            ) : null}
            <Button disabled={linking} onClick={() => void startLink()}>
              {linking ? 'Waiting for approval…' : 'Link Account'}
            </Button>
            {linkSession ? (
              <div className="rounded-md border border-border/60 bg-background/30 p-3 text-sm">
                <p>Go to the website and enter this code:</p>
                <p className="mt-2 font-mono text-lg text-accent">{linkSession.userCode}</p>
                <p className="mt-2 text-xs text-muted">{linkSession.verificationUrl}</p>
                <p className="mt-2 text-xs text-muted-dim">
                  If the website says &quot;Invalid code&quot;, set Settings → Online registry to your website URL
                  (production: <span className="font-mono">{WEBSITE_URL}</span>; local Docker:{' '}
                  <span className="font-mono">{LOCAL_REGISTRY_BASE_URL}</span> — not port 8787), then request a new code.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-background-elevated/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-dim">Cloud sync</h2>
        <p className="mt-2 text-xs text-muted">
          Syncs XP, completions, and achievements only. Terminal commands, secrets, and lab passwords are never uploaded.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={status?.cloudSyncEnabled !== false}
            onChange={(e) => void togglePref('cloudSyncEnabled', e.target.checked)}
          />
          Enable cloud progress sync
        </label>
        <Button className="mt-3" size="sm" disabled={!status?.linked || syncing} onClick={() => void syncNow()}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
        {lastSyncAt ? (
          <p className="mt-2 text-xs text-muted-dim">Last synced {new Date(lastSyncAt).toLocaleString()}</p>
        ) : null}
        {status?.linked ? (
          <div className="mt-4 rounded-md border border-border/60 bg-background/30 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Saved on your account</p>
            {cloudProgressError ? (
              <p className="mt-2 text-warning">{cloudProgressError}</p>
            ) : cloudProfile ? (
              <div className="mt-2 space-y-1">
                <p>
                  <strong>{cloudProfile.xp ?? 0}</strong> XP · level <strong>{cloudProfile.level ?? 1}</strong> ·{' '}
                  <strong>{cloudCompletedCount}</strong> labs completed
                </p>
                <p className="text-xs text-muted">
                  View full details on the website Account page after syncing.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-muted">Loading cloud progress…</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-background-elevated/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-dim">Leaderboard</h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={status?.leaderboardOptIn === true}
            onChange={(e) => void togglePref('leaderboardOptIn', e.target.checked)}
          />
          Show my scores on the global leaderboard (opt-in)
        </label>
        {leaderboard.length === 0 ? (
          <p className="mt-3 text-xs text-muted">No leaderboard entries yet. Opt in and sync cloud progress to compete.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {leaderboard.slice(0, 10).map((e) => (
              <LeaderboardProfileCard
                key={e.userId ?? e.user_id ?? `rank-${e.rank}`}
                entry={e}
                highlight={Boolean(status?.user?.id && (e.userId === status.user.id || e.user_id === status.user.id))}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-background-elevated/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-dim">Email notifications</h2>
        <p className="mt-2 text-xs text-muted">
          Emails are sent only by the server using predefined templates to your linked account email
          {status?.user?.email ? (
            <>
              {' '}
              (<span className="font-mono text-gray-300">{status.user.email}</span>)
            </>
          ) : null}
          . This app cannot choose recipients, subjects, or message bodies.
        </p>

        {!status?.linked ? (
          <p className="mt-3 text-sm text-muted">
            Link your account above to choose which mission emails you receive.
          </p>
        ) : notifPrefsLoading ? (
          <p className="mt-3 text-sm text-muted">Loading notification preferences…</p>
        ) : notifPrefsError ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-warning">{notifPrefsError}</p>
            <Button size="sm" variant="ghost" onClick={() => void refresh()}>
              Retry
            </Button>
          </div>
        ) : notifPrefs ? (
          <div className="mt-3 space-y-3 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={notifPrefs.emailLabCompletions !== false}
                onChange={(e) => void toggleNotifPref('emailLabCompletions', e.target.checked)}
              />
              <span>
                Lab completion confirmation emails
                <span className="mt-0.5 block text-xs text-muted">Sent when you finish a lab for the first time.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={notifPrefs.emailLabDeploymentReady !== false}
                onChange={(e) => void toggleNotifPref('emailLabDeploymentReady', e.target.checked)}
              />
              <span>
                Lab deployment ready emails (when a mission finishes starting)
                <span className="mt-0.5 block text-xs text-muted">Sent when a lab environment finishes starting locally.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={notifPrefs.emailLabUpdates === true}
                onChange={(e) => void toggleNotifPref('emailLabUpdates', e.target.checked)}
              />
              <span>
                Lab update emails
                <span className="mt-0.5 block text-xs text-muted">Sent when a lab you use gets a new published version.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={notifPrefs.emailNewVerifiedLabs === true}
                onChange={(e) => void toggleNotifPref('emailNewVerifiedLabs', e.target.checked)}
              />
              <span>
                New verified lab announcements (lab ready to download)
                <span className="mt-0.5 block text-xs text-muted">Sent when an admin verifies a new lab in the registry.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={notifPrefs.emailLeaderboardMilestones === true}
                onChange={(e) => void toggleNotifPref('emailLeaderboardMilestones', e.target.checked)}
              />
              <span>
                Leaderboard milestone emails
                <span className="mt-0.5 block text-xs text-muted">
                  Sent when your global leaderboard XP crosses a milestone (requires leaderboard opt-in).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={notifPrefs.emailSecurityAlerts === true}
                onChange={(e) => void toggleNotifPref('emailSecurityAlerts', e.target.checked)}
              />
              <span>
                Security alert emails
                <span className="mt-0.5 block text-xs text-muted">
                  Reserved for account security events (not sent by routine lab activity).
                </span>
              </span>
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" disabled={!status?.linked || emailBusy} onClick={() => void resendVerification()}>
            Resend verification email
          </Button>
          <Button size="sm" variant="ghost" disabled={!status?.linked || emailBusy} onClick={() => void emailPasswordReset()}>
            Email password reset link
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void openPasswordResetWebsite()}>
            Reset password on website
          </Button>
        </div>
      </section>
    </div>
  )
}

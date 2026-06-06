import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'

const NOTIF_LABELS = [
  { key: 'emailLabCompletions', label: 'Lab completion confirmations' },
  { key: 'emailLabDeploymentReady', label: 'Lab deployment ready' },
  { key: 'emailLabUpdates', label: 'Lab updates' },
  { key: 'emailNewVerifiedLabs', label: 'New verified labs' },
  { key: 'emailLeaderboardMilestones', label: 'Leaderboard milestones' },
  { key: 'emailSecurityAlerts', label: 'Security alerts' }
]

export default function AccountPage({ user, onRequireLogin, onPublish }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) {
      setSummary(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api('/api/account/summary')
      setSummary(res)
    } catch (err) {
      setError(err.message)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function saveAccountPrefs(partial) {
    setSaving(true)
    try {
      await api('/api/account/preferences', {
        method: 'POST',
        body: JSON.stringify(partial)
      })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveNotifPrefs(partial) {
    setSaving(true)
    try {
      await api('/api/notifications/preferences', {
        method: 'POST',
        body: JSON.stringify(partial)
      })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <section className="card">
        <h2>Account</h2>
        <p style={{ color: 'var(--text-muted)' }}>Sign in to view cloud progress and manage account settings.</p>
        <button type="button" className="btn" onClick={() => onRequireLogin?.()}>
          Sign in
        </button>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="card">
        <h2>Account</h2>
        <p style={{ color: 'var(--text-muted)' }}>Loading account…</p>
      </section>
    )
  }

  const progress = summary?.progress
  const profile = progress?.profile ?? { xp: 0, level: 1, total_completed: 0 }
  const completedLabs = progress?.labs?.filter((row) => row.completed === 1) ?? []

  return (
    <div className="account-grid">
      <section className="card">
        <h2>Profile</h2>
        <p>
          <strong>{summary?.user?.displayName ?? user.displayName ?? user.email}</strong>
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{summary?.user?.email ?? user.email}</p>
        {summary?.user?.emailVerified === false ? (
          <p style={{ color: 'var(--warning-soft)', fontSize: '0.85rem' }}>Email not verified yet.</p>
        ) : null}
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '1rem' }}>
          Progress shown here is synced from the desktop application when you are signed in and linked.
        </p>
        {onPublish ? (
          <button type="button" className="btn btn-sm" style={{ marginTop: '1rem' }} onClick={() => onPublish()}>
            Publish a lab pack
          </button>
        ) : null}
      </section>

      <section className="card">
        <h2>Cloud progress</h2>
        {error ? <p style={{ color: 'var(--danger-soft)' }}>{error}</p> : null}
        <div className="account-stats">
          <div>
            <span className="account-stat-value">{profile.xp ?? 0}</span>
            <span className="account-stat-label">XP</span>
          </div>
          <div>
            <span className="account-stat-value">{profile.level ?? 1}</span>
            <span className="account-stat-label">Level</span>
          </div>
          <div>
            <span className="account-stat-value">{completedLabs.length}</span>
            <span className="account-stat-label">Labs completed</span>
          </div>
          <div>
            <span className="account-stat-value">{progress?.achievements?.length ?? 0}</span>
            <span className="account-stat-label">Achievements</span>
          </div>
        </div>
        {completedLabs.length > 0 ? (
          <>
            <h3 style={{ fontSize: '0.95rem', marginTop: '1.25rem' }}>Completed labs</h3>
            <ul className="account-lab-list">
              {completedLabs.slice(0, 20).map((row) => (
                <li key={row.lab_id}>
                  <code>{row.lab_id}</code>
                  {row.xp_earned ? ` · ${row.xp_earned} XP` : ''}
                  {row.best_time_sec ? ` · ${row.best_time_sec}s` : ''}
                </li>
              ))}
            </ul>
            {completedLabs.length > 20 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>+ {completedLabs.length - 20} more</p>
            ) : null}
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem' }}>
            No lab progress saved yet. Link the desktop app and use <strong>Sync now</strong> on the Account page, or
            complete a lab while linked with cloud sync enabled.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Preferences</h2>
        <label className="account-check">
          <input
            type="checkbox"
            disabled={saving}
            checked={summary?.preferences?.leaderboardOptIn === true}
            onChange={(e) => void saveAccountPrefs({ leaderboardOptIn: e.target.checked })}
          />
          Show my scores on the global leaderboard
        </label>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Leaderboard uses verified cloud progress. Opt in here or from the desktop app Account page.
        </p>
      </section>

      <section className="card">
        <h2>Email notifications</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Emails go to your account address above. The desktop app uses the same preferences when linked.
        </p>
        <div className="account-notif-list">
          {NOTIF_LABELS.map(({ key, label }) => (
            <label key={key} className="account-check">
              <input
                type="checkbox"
                disabled={saving}
                checked={summary?.notificationPreferences?.[key] === true}
                onChange={(e) => void saveNotifPrefs({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}

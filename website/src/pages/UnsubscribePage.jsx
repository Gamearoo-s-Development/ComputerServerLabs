import React, { useEffect, useState } from 'react'
import { api } from '../api/client.js'

export default function UnsubscribePage({ token, scope, onComplete, onDone }) {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState(null)

  useEffect(() => {
    if (!token || !scope) {
      setStatus('error')
      setMessage('This unsubscribe link is incomplete. Open the full link from your email.')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams({ token, scope })
        const res = await api(`/api/notifications/unsubscribe?${params.toString()}`, {
          method: 'POST',
          body: JSON.stringify({ token, scope })
        })
        if (cancelled) return
        setDetails(res)
        setStatus('success')
        setMessage(
          res.alreadyUnsubscribed
            ? `You were already unsubscribed from ${res.scopeLabel ?? 'these emails'}.`
            : `You have been unsubscribed from ${res.scopeLabel ?? 'these emails'}.`
        )
        onComplete?.(res)
        document.title = res.alreadyUnsubscribed
          ? 'Already unsubscribed — Computer Server Labs'
          : 'Unsubscribed — Computer Server Labs'
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Unsubscribe failed')
        document.title = 'Unsubscribe failed — Computer Server Labs'
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, scope, onComplete])

  return (
    <section className="card verify-card">
      {status === 'loading' ? (
        <>
          <div className="verify-icon verify-icon--loading" aria-hidden>
            …
          </div>
          <h2>Updating email preferences</h2>
          <p className="text-muted">Please wait while we turn off these notification emails…</p>
        </>
      ) : null}

      {status === 'success' ? (
        <>
          <div className="verify-icon verify-icon--success" aria-hidden>
            ✓
          </div>
          <h2>You&apos;re unsubscribed</h2>
          <p className="text-success">{message}</p>
          {details?.email ? (
            <p className="text-muted verify-detail">
              Account: <strong>{details.email}</strong>
            </p>
          ) : null}
          {details?.scopeLabel ? (
            <p className="text-muted verify-detail">
              Turned off: <strong>{details.scopeLabel}</strong>
            </p>
          ) : null}
          <p className="text-muted" style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
            A confirmation banner is shown at the top of this site. Verification and password reset emails are not
            affected. Re-enable notifications anytime in the desktop app under{' '}
            <strong>Account → Email notifications</strong>.
          </p>
        </>
      ) : null}

      {status === 'error' ? (
        <>
          <div className="verify-icon verify-icon--error" aria-hidden>
            !
          </div>
          <h2>Could not unsubscribe</h2>
          <p className="text-danger">{message}</p>
          <p className="text-muted">
            Sign in on the website or use the desktop app Account page to manage notification preferences.
          </p>
        </>
      ) : null}

      <div className="verify-actions">
        <button type="button" className="btn" onClick={() => onDone?.('labs')}>
          Browse labs
        </button>
      </div>
    </section>
  )
}

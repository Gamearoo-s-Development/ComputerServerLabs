import React, { useEffect, useState } from 'react'
import { api } from '../api/client.js'

export default function VerifyEmailPage({ token, onDone }) {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('This verification link is incomplete. Open the full link from your email.')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await api('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token })
        })
        if (cancelled) return
        setDetails(res)
        setStatus(res.alreadyVerified ? 'already' : 'success')
        setMessage(
          res.alreadyVerified
            ? 'Your email was already verified. You are all set.'
            : 'Your email has been verified successfully. You can now use all account features.'
        )
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Verification failed')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <section className="card verify-card">
      {status === 'loading' ? (
        <>
          <div className="verify-icon verify-icon--loading" aria-hidden>
            …
          </div>
          <h2>Verifying your email</h2>
          <p className="text-muted">Please wait while we confirm your account.</p>
        </>
      ) : null}

      {status === 'success' ? (
        <>
          <div className="verify-icon verify-icon--success" aria-hidden>
            ✓
          </div>
          <h2>Email verified</h2>
          <p className="text-success">{message}</p>
          {details?.email ? (
            <p className="text-muted verify-detail">
              Verified address: <strong>{details.email}</strong>
            </p>
          ) : null}
        </>
      ) : null}

      {status === 'already' ? (
        <>
          <div className="verify-icon verify-icon--success" aria-hidden>
            ✓
          </div>
          <h2>Already verified</h2>
          <p className="text-muted">{message}</p>
        </>
      ) : null}

      {status === 'error' ? (
        <>
          <div className="verify-icon verify-icon--error" aria-hidden>
            !
          </div>
          <h2>Verification failed</h2>
          <p className="text-danger">{message}</p>
          <p className="text-muted">
            Sign in and use <strong>Resend verification email</strong> in the desktop app Account page, or register
            again if needed.
          </p>
        </>
      ) : null}

      <div className="verify-actions">
        <button type="button" className="btn" onClick={() => onDone?.('labs')}>
          Browse labs
        </button>
        {status === 'error' ? (
          <button type="button" className="btn-ghost btn" onClick={() => onDone?.('login')}>
            Sign in
          </button>
        ) : null}
      </div>
    </section>
  )
}

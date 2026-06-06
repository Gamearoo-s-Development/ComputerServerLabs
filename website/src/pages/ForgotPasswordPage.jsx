import React, { useState } from 'react'
import { api } from '../api/client.js'

export default function ForgotPasswordPage({ onBackToLogin }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const res = await api('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      })
      setMessage(res.message ?? 'If an account exists for that address, check your inbox.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" style={{ maxWidth: 420 }}>
      <h2>Reset password</h2>
      <p style={{ color: '#94a3b8' }}>
        Enter the email on your account. We only send reset links to that address — never to a different inbox.
      </p>
      <form onSubmit={submit} style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
        <input
          type="email"
          placeholder="Account email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Sending…' : 'Email reset link'}
        </button>
      </form>
      {message ? <p style={{ color: '#86efac', marginTop: '0.75rem' }}>{message}</p> : null}
      {error ? <p style={{ color: '#f87171', marginTop: '0.75rem' }}>{error}</p> : null}
      <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '1rem' }}>
        Linked desktop app? You can also request a reset from <strong>Account → Email password reset link</strong> in the
        application.
      </p>
      {onBackToLogin ? (
        <button type="button" className="btn-ghost btn btn-sm" style={{ marginTop: '0.75rem' }} onClick={() => onBackToLogin()}>
          Back to sign in
        </button>
      ) : null}
    </section>
  )
}

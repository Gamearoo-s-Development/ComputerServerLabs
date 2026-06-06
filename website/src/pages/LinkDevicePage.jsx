import React, { useState } from 'react'
import { api, saveSession } from '../api/client.js'

function normalizeDeviceUserCode(raw) {
  const alnum = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (alnum.length !== 8) return ''
  return `${alnum.slice(0, 4)}-${alnum.slice(4)}`
}

export default function LinkDevicePage({ onAuthed }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userCode, setUserCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loginAndApprove(e) {
    e.preventDefault()
    setError('')
    try {
      const login = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })
      saveSession(login)
      const normalizedCode = normalizeDeviceUserCode(userCode)
      if (!normalizedCode) {
        throw new Error('Enter the 8-character code shown in the desktop app')
      }
      const approve = await api('/api/auth/device/approve', {
        method: 'POST',
        body: JSON.stringify({ userCode: normalizedCode })
      })
      const sent = approve.verificationEmailSent
        ? ' Check your inbox to verify your email if you have not already.'
        : ''
      setMessage(`Your desktop app is linked. You can return to the application.${sent}`)
      onAuthed?.(login)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="card" style={{ maxWidth: 420 }}>
      <header className="page-intro" style={{ marginBottom: '1.25rem' }}>
        <h2>Link desktop app</h2>
        <p>
          Sign in with your account, then enter the one-time code from the desktop app to connect your installation and
          sync progress.
        </p>
      </header>
      <form className="publish-form" onSubmit={loginAndApprove}>
        <label className="publish-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="publish-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <label className="publish-field">
          <span>Device code</span>
          <input
            placeholder="ABCD-EFGH"
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            required
            autoComplete="one-time-code"
          />
        </label>
        <button type="submit" className="btn">
          Sign in and link
        </button>
      </form>
      {message ? <p className="text-success" style={{ marginTop: '1rem' }}>{message}</p> : null}
      {error ? <p className="text-danger" style={{ marginTop: '1rem' }}>{error}</p> : null}
      <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '1.25rem', lineHeight: 1.5 }}>
        Your password stays in the browser for this step only. The desktop app stores secure tokens — not your website
        password.
      </p>
    </section>
  )
}

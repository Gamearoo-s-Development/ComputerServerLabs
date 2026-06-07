import React, { useState } from 'react'
import { api, saveSession } from '../api/client.js'

export default function LoginPage({ onAuthed, onForgotPassword }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body =
        mode === 'login'
          ? { email, password }
          : { email, password, displayName: displayName || undefined }
      const res = await api(path, { method: 'POST', body: JSON.stringify(body) })
      if (mode === 'register' && res.verificationEmailSentTo) {
        setInfo(`Check ${res.verificationEmailSentTo} for a verification link.`)
        return
      }
      saveSession(res)
      onAuthed?.(res)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="card" style={{ maxWidth: 400 }}>
      <header className="page-intro">
        <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
        <p className="text-muted">
          {mode === 'login'
            ? 'Access your catalog, progress, and publishing tools.'
            : 'Free account for progress sync, publishing labs, and the leaderboard.'}
        </p>
      </header>
      <form onSubmit={submit} style={{ display: 'grid', gap: '0.75rem' }}>
        {mode === 'register' ? (
          <input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        ) : null}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="btn">{mode === 'login' ? 'Sign in' : 'Register'}</button>
      </form>
      <div className="login-secondary" style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" className="btn-ghost btn btn-sm" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Create account' : 'Sign in instead'}
        </button>
        {mode === 'login' && onForgotPassword ? (
          <button type="button" className="btn-ghost btn btn-sm" onClick={() => onForgotPassword()}>
            Forgot password
          </button>
        ) : null}
      </div>
      {info ? <p style={{ color: '#86efac', marginTop: '0.75rem' }}>{info}</p> : null}
      {error ? <p style={{ color: '#f87171' }}>{error}</p> : null}
      {mode === 'register' ? (
        <p className="legal-consent" style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.85rem', lineHeight: 1.5 }}>
          By creating an account, you agree to our{' '}
          <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
        </p>
      ) : null}
    </section>
  )
}

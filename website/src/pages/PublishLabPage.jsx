import React, { useCallback, useEffect, useState } from 'react'
import { api, apiUpload } from '../api/client.js'

export default function PublishLabPage({ user, onRequireLogin, onPublished }) {
  const [file, setFile] = useState(null)
  const [changelog, setChangelog] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [myLabs, setMyLabs] = useState([])

  const loadMine = useCallback(async () => {
    if (!user) {
      setMyLabs([])
      return
    }
    try {
      const res = await api('/api/labs/mine')
      setMyLabs(res.labs ?? [])
    } catch {
      setMyLabs([])
    }
  }, [user])

  useEffect(() => {
    void loadMine()
  }, [loadMine])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) {
      onRequireLogin?.()
      return
    }
    if (!file) {
      setError('Choose a lab pack file exported from the desktop application.')
      return
    }
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const form = new FormData()
      form.append('labPack', file)
      if (changelog.trim()) form.append('changelog', changelog.trim())
      const res = await apiUpload('/api/labs/publish', form)
      setResult(res)
      setFile(null)
      setChangelog('')
      await loadMine()
      onPublished?.(res.labId)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <section className="card">
        <header className="page-intro">
          <h2>Publish a lab</h2>
          <p className="text-muted">Sign in to share your training scenarios with the community.</p>
        </header>
        <button type="button" className="btn" onClick={() => onRequireLogin?.()}>
          Sign in
        </button>
      </section>
    )
  }

  if (user.emailVerified === false) {
    return (
      <section className="card">
        <header className="page-intro">
          <h2>Publish a lab</h2>
          <p className="text-warning">Verify your email address before publishing to the catalog.</p>
        </header>
      </section>
    )
  }

  return (
    <div className="publish-layout">
      <section className="card">
        <header className="page-intro">
          <h2>Publish a lab</h2>
          <p className="text-muted">
            Share a lab you created in the desktop application. Upload your exported lab pack to publish a new version
            to the catalog. All published labs are available for anyone to download.
          </p>
        </header>

        <form className="publish-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="publish-field">
            <span>Lab pack file</span>
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="publish-field">
            <span>Changelog (optional)</span>
            <textarea
              rows={3}
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="What changed in this version?"
            />
          </label>
          {error ? <p className="text-danger">{error}</p> : null}
          {result ? (
            <p className="text-success">
              Published <strong>{result.labId}</strong> version <strong>{result.version}</strong>.
            </p>
          ) : null}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Uploading…' : 'Publish to catalog'}
          </button>
        </form>
      </section>

      {myLabs.length > 0 ? (
        <section className="card">
          <h3>Your published labs</h3>
          <ul className="account-lab-list">
            {myLabs.map((lab) => (
              <li key={lab.id}>
                <strong>{lab.title}</strong> (<code>{lab.id}</code>)
                {lab.latestVersion ? ` · v${lab.latestVersion.version}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

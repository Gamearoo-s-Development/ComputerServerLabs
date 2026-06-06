import React, { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import DownloadAppButton from '../components/DownloadAppButton.jsx'
import LabBadgeList from '../components/LabBadgeList.jsx'
import LabSourceViewer from '../components/LabSourceViewer.jsx'

export default function LabDetailPage({ labId, onBack }) {
  const [lab, setLab] = useState(null)
  const [error, setError] = useState('')
  const [showSource, setShowSource] = useState(false)

  useEffect(() => {
    setLab(null)
    setError('')
    setShowSource(false)
    api(`/api/labs/${labId}`)
      .then((res) => setLab(res.lab))
      .catch((e) => setError(e.message))
  }, [labId])

  if (error) return <p className="text-danger">{error}</p>
  if (!lab) return <p className="loading">Loading…</p>

  const downloadHref = `/api/labs/${labId}/download`
  const isCatalogOnly = !lab.isBundled && (lab.badges ?? []).includes('catalog-only')

  return (
    <section className="card">
      <button type="button" className="btn-ghost btn btn-sm" onClick={onBack} style={{ marginBottom: '1rem' }}>
        ← Back to labs
      </button>
      <h2>{lab.title}</h2>
      <LabBadgeList lab={lab} />
      {lab.isBundled ? (
        <p className="lab-bundled-note">
          This lab is <strong>bundled with the desktop application</strong>. Install the app to run it locally, or
          download the pack below for the latest catalog version.
        </p>
      ) : null}
      {isCatalogOnly ? (
        <p className="lab-catalog-note">
          This scenario is <strong>not included in the desktop installer</strong>. Download the pack below to add it to
          your lab library in the app.
        </p>
      ) : null}
      <p className="text-muted">{lab.description}</p>
      <p>
        <strong>Runtime:</strong> {lab.runtime}
      </p>
      <p>
        <strong>Difficulty:</strong> {lab.difficulty} · <strong>Category:</strong> {lab.category}
      </p>
      {!lab.isBundled && lab.creatorName ? (
        <p className="text-muted" style={{ fontSize: '0.875rem' }}>
          Published by {lab.creatorName}
        </p>
      ) : null}
      {lab.latestVersion ? (
        <div style={{ marginTop: '1.25rem' }}>
          <p>
            <strong>Version:</strong> {lab.latestVersion.version}
          </p>
          <p>
            <strong>Checksum (SHA-256):</strong> <code>{lab.latestVersion.checksumSha256}</code>
          </p>
          <div className="lab-detail__actions">
            <a className="btn" href={downloadHref}>
              Download lab pack
            </a>
            <DownloadAppButton className="btn btn-ghost" />
          </div>
        </div>
      ) : null}
      {lab.latestVersion ? (
        <div className="lab-detail__source">
          <div className="lab-detail__source-toggle">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={showSource}
              onClick={() => setShowSource((open) => !open)}
            >
              {showSource ? 'Hide lab source' : 'View lab source'}
            </button>
            {!showSource ? (
              <p className="text-muted lab-detail__source-hint">
                Dockerfile, setup scripts, and shared build files — optional transparency for reviewers and learners.
              </p>
            ) : null}
          </div>
          {showSource ? <LabSourceViewer labId={labId} /> : null}
        </div>
      ) : null}
    </section>
  )
}

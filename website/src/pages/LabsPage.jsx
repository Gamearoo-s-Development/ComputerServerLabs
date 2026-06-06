import React, { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import DownloadAppButton from '../components/DownloadAppButton.jsx'
import LabBadgeList from '../components/LabBadgeList.jsx'

const CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'linux', label: 'Linux' },
  { value: 'networking', label: 'Networking' },
  { value: 'storage', label: 'Storage' },
  { value: 'security', label: 'Security' },
  { value: 'general', label: 'General' }
]

export default function LabsPage({ onOpen }) {
  const [labs, setLabs] = useState([])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (category) params.set('category', category)
    if (source === 'bundled') params.set('badge', 'bundled')
    if (source === 'catalog-only') params.set('badge', 'catalog-only')
    api(`/api/labs?${params}`)
      .then((res) => setLabs(res.labs ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [q, category, source])

  return (
    <section>
      <header className="page-intro page-intro--row">
        <div>
          <h2>Lab catalog</h2>
          <p>
            Browse training scenarios for Linux, networking, containers, and day-to-day administration. Labs marked{' '}
            <strong>Bundled with app</strong> ship inside the desktop installer — you can also download packs here for
            updates or offline use.
          </p>
        </div>
        <DownloadAppButton className="btn" />
      </header>
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search labs…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search labs"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category filter">
          {CATEGORIES.map((c) => (
            <option key={c.value || 'all'} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source filter">
          <option value="">All labs</option>
          <option value="bundled">Bundled with app</option>
          <option value="catalog-only">Catalog download only</option>
        </select>
      </div>

      {error ? <p className="text-danger">{error}</p> : null}
      {loading ? <p className="loading">Loading labs…</p> : null}

      {!loading && !error ? (
        <>
          <p className="lab-count">{labs.length} lab{labs.length === 1 ? '' : 's'} available</p>
          {labs.length === 0 ? (
            <div className="card empty-state">
              <p>No labs match your filters.</p>
            </div>
          ) : (
            <div className="grid">
              {labs.map((lab) => (
                <article key={lab.id} className="card lab-card">
                  <h3>{lab.title}</h3>
                  <LabBadgeList lab={lab} />
                  <p className="desc">
                    {lab.description?.length > 140 ? `${lab.description.slice(0, 140)}…` : lab.description}
                  </p>
                  <p className="meta">
                    {lab.difficulty} · {lab.category}
                    {lab.isBundled ? '' : lab.creatorName ? ` · ${lab.creatorName}` : ''}
                  </p>
                  <div className="lab-card__actions">
                    <button type="button" className="btn btn-sm" onClick={() => onOpen(lab.id)}>
                      Details
                    </button>
                    {lab.latestVersion ? (
                      <a className="btn btn-sm btn-ghost" href={`/api/labs/${lab.id}/download`}>
                        Download
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}

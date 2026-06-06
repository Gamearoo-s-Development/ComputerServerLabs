import React, { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import LeaderboardProfileCard from '../components/LeaderboardProfileCard.jsx'

export default function LeaderboardPage({ user }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api('/api/leaderboards/global')
      .then((res) => setEntries(res.entries ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const yourUserId = user?.id ?? user?.userId

  return (
    <section>
      <header className="page-intro">
        <h2>Global leaderboard</h2>
        <p>
          Top learners by verified cloud progress. Each card shows level, XP toward the next level, labs completed, and
          achievements. Opt in from your account settings to appear here.
        </p>
      </header>

      {error ? <p className="text-danger">{error}</p> : null}
      {loading ? <p className="loading">Loading leaderboard…</p> : null}

      {!loading && !error && entries.length > 0 ? (
        <div className="leaderboard-grid">
          {entries.map((entry) => (
            <LeaderboardProfileCard
              key={entry.userId ?? entry.user_id ?? `${entry.display_name}-${entry.rank}`}
              entry={entry}
              highlight={Boolean(yourUserId && (entry.userId === yourUserId || entry.user_id === yourUserId))}
            />
          ))}
        </div>
      ) : null}

      {!loading && !error && entries.length === 0 ? (
        <div className="card empty-state">
          <p>No entries yet. Complete labs with cloud sync enabled and turn on leaderboard opt-in to appear here.</p>
        </div>
      ) : null}
    </section>
  )
}

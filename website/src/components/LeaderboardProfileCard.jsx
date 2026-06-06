import React from 'react'
import { leaderboardInitials, xpProgressWithinLevel } from '../lib/leaderboardProgress.js'

/**
 * @param {{ entry: Record<string, unknown>, highlight?: boolean }} props
 */
export default function LeaderboardProfileCard({ entry, highlight = false }) {
  const rank = Number(entry.rank ?? 0)
  const name = String(entry.displayName ?? entry.display_name ?? 'Learner')
  const xp = Number(entry.xp ?? 0)
  const level = Number(entry.level ?? 1)
  const completedLabs = Number(entry.completedLabs ?? entry.completed_labs ?? 0)
  const achievementCount = Number(entry.achievementCount ?? entry.achievement_count ?? 0)
  const hintsUsed = Number(entry.hintsUsed ?? entry.hints_used ?? 0)
  const { percent, floor, ceiling } = xpProgressWithinLevel(xp, level)

  return (
    <article
      className={`leaderboard-card${highlight ? ' leaderboard-card--you' : ''}${rank <= 3 ? ' leaderboard-card--top' : ''}`}
      aria-label={`Rank ${rank}: ${name}`}
    >
      <div className="leaderboard-card__rank" aria-hidden="true">
        {rank <= 3 ? (
          <span className={`leaderboard-card__medal leaderboard-card__medal--${rank}`}>{rank}</span>
        ) : (
          rank
        )}
      </div>
      <div className="leaderboard-card__avatar" aria-hidden="true">
        {leaderboardInitials(name)}
      </div>
      <div className="leaderboard-card__main">
        <header className="leaderboard-card__header">
          <h3 className="leaderboard-card__name">{name}</h3>
          <span className="leaderboard-card__level">Level {level}</span>
        </header>
        <div className="leaderboard-card__progress">
          <div className="leaderboard-card__progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="leaderboard-card__progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <p className="leaderboard-card__progress-label">
            <strong>{xp.toLocaleString()}</strong> XP
            <span className="text-muted">
              {' '}
              · {floor.toLocaleString()}–{ceiling.toLocaleString()} for next level
            </span>
          </p>
        </div>
        <ul className="leaderboard-card__stats">
          <li>
            <span className="leaderboard-card__stat-value">{completedLabs}</span>
            <span className="leaderboard-card__stat-label">Labs done</span>
          </li>
          <li>
            <span className="leaderboard-card__stat-value">{achievementCount}</span>
            <span className="leaderboard-card__stat-label">Achievements</span>
          </li>
          <li>
            <span className="leaderboard-card__stat-value">{hintsUsed}</span>
            <span className="leaderboard-card__stat-label">Hints used</span>
          </li>
        </ul>
      </div>
    </article>
  )
}

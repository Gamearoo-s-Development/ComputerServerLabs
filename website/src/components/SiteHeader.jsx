import React from 'react'
import DownloadAppButton from './DownloadAppButton.jsx'
import { GITHUB_REPO_URL } from '../lib/siteConfig.js'

export default function SiteHeader({ page, user, onNavigate, onLogout, onResendVerification }) {
  const navLink = (id, label, active = false) => (
    <button
      type="button"
      className={`nav__link btn-ghost btn${active || page === id ? ' nav__link--active' : ''}`}
      onClick={() => onNavigate(id)}
    >
      {label}
    </button>
  )

  const labsActive = page === 'labs' || page === 'lab'

  return (
    <header className="site-header">
      <div className="site-header__top">
        <button
          type="button"
          className="site-brand"
          onClick={() => onNavigate('home')}
          aria-label="Computer Server Labs home"
        >
          <img
            className="site-brand__logo"
            src="/logo.png"
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const fallback = document.getElementById('site-title-fallback')
              if (fallback) fallback.hidden = false
            }}
          />
          <span id="site-title-fallback" className="site-brand__text" hidden>
            Computer Server Labs
          </span>
        </button>

        <div className="site-header__actions">
          <DownloadAppButton />
          {user ? (
            <>
              {user.emailVerified === false ? (
                <button type="button" className="btn-ghost btn btn-sm" onClick={() => onResendVerification?.()}>
                  Verify email
                </button>
              ) : null}
              <button
                type="button"
                className={`btn-ghost btn btn-sm${page === 'account' ? ' nav__link--active' : ''}`}
                onClick={() => onNavigate('account')}
                title={user.email}
              >
                {user.displayName ?? user.email}
              </button>
              <button type="button" className="btn-ghost btn btn-sm" onClick={() => onLogout?.()}>
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              className={`btn btn-sm${page === 'login' ? ' nav__link--active' : ''}`}
              onClick={() => onNavigate('login')}
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      <nav className="site-header__nav" aria-label="Main">
        {navLink('home', 'Home')}
        <button
          type="button"
          className={`nav__link btn-ghost btn${labsActive ? ' nav__link--active' : ''}`}
          onClick={() => onNavigate('labs')}
        >
          Labs
        </button>
        {navLink('publish', 'Publish')}
        {navLink('leaderboard', 'Leaderboard')}
        {navLink('link-device', 'Link app')}
        <a
          href={GITHUB_REPO_URL}
          className="nav__link btn-ghost btn"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source
        </a>
      </nav>
    </header>
  )
}

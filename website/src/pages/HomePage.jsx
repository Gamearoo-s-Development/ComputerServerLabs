import React from 'react'
import DownloadAppButton from '../components/DownloadAppButton.jsx'

const FEATURES = [
  {
    title: 'Real terminals',
    text: 'Work in shell and SSH sessions inside isolated lab environments — the same tools you use on the job.'
  },
  {
    title: 'Structured objectives',
    text: 'Each lab guides you step by step with clear goals, hints when you need them, and progress you can track.'
  },
  {
    title: 'Progress and achievements',
    text: 'Earn XP, level up, unlock labs in order, and collect achievements as you build practical skills.'
  },
  {
    title: 'Lab catalog',
    text: 'Browse official and community scenarios, download lab packs, and run them in the desktop application.'
  },
  {
    title: 'Share your labs',
    text: 'Publish labs you build so others can download and learn from your scenarios.'
  },
  {
    title: 'Cloud account',
    text: 'Sign in to sync progress across devices, manage preferences, and join the global leaderboard.'
  }
]

export default function HomePage({ onBrowseLabs, onLinkDevice, onPublish, onSignIn, user }) {
  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__content">
          <p className="eyebrow">Computer Server Labs</p>
          <h1 id="hero-heading" className="hero__title">
            Hands-on system administration training
          </h1>
          <p className="hero__lead">
            The desktop application is where you run labs, terminals, and workstations. This site is your lab catalog,
            account, and community hub — discover scenarios, download packs, and track your progress.
          </p>
          <div className="hero__actions">
            <DownloadAppButton className="btn btn-lg" />
            <button type="button" className="btn btn-lg btn-ghost" onClick={() => onBrowseLabs?.()}>
              Browse labs
            </button>
            {!user ? (
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => onSignIn?.()}>
                Create free account
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="steps" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="section-title">
          How it works
        </h2>
        <ol className="steps__list">
          <li className="steps__item">
            <span className="steps__num" aria-hidden="true">
              1
            </span>
            <div>
              <h3 className="steps__title">Get the desktop app</h3>
              <p className="steps__text">
                Install Computer Server Labs on your computer. Starter labs are bundled with the app; the catalog adds
                more scenarios and updates.
              </p>
              <DownloadAppButton className="btn btn-sm" />
            </div>
          </li>
          <li className="steps__item">
            <span className="steps__num" aria-hidden="true">
              2
            </span>
            <div>
              <h3 className="steps__title">Choose a lab</h3>
              <p className="steps__text">
                Explore the catalog for Linux, networking, containers, and everyday administration topics. Download a lab
                pack and open it in the app.
              </p>
              <button type="button" className="btn btn-sm" onClick={() => onBrowseLabs?.()}>
                View catalog
              </button>
            </div>
          </li>
          <li className="steps__item">
            <span className="steps__num" aria-hidden="true">
              3
            </span>
            <div>
              <h3 className="steps__title">Practice and sync</h3>
              <p className="steps__text">
                Complete objectives in real terminals. Link the app to your account to save progress and appear on the
                leaderboard.
              </p>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => onLinkDevice?.()}>
                Link your app
              </button>
            </div>
          </li>
        </ol>
      </section>

      <section className="features" aria-labelledby="features-heading">
        <h2 id="features-heading" className="section-title">
          Built for learners and practitioners
        </h2>
        <ul className="features__grid">
          {FEATURES.map((f) => (
            <li key={f.title} className="feature-card">
              <h3 className="feature-card__title">{f.title}</h3>
              <p className="feature-card__text">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="cta-band card">
        <h2 className="cta-band__title">Ready to start?</h2>
        <p className="cta-band__text">
          {user
            ? 'Open the desktop app, pick a lab from the catalog, or share your own scenarios with the community.'
            : 'Create a free account to sync progress, publish labs, and join the leaderboard.'}
        </p>
        <div className="cta-band__actions">
          <DownloadAppButton className="btn" />
          <button type="button" className="btn btn-ghost" onClick={() => onBrowseLabs?.()}>
            Browse labs
          </button>
          {user ? (
            <button type="button" className="btn btn-ghost" onClick={() => onPublish?.()}>
              Publish a lab
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => onSignIn?.()}>
              Sign in
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

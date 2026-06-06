import React from 'react'
import DownloadAppButton from '../components/DownloadAppButton.jsx'
import { GITHUB_REPO_URL, LICENSE_NAME, LICENSE_URL } from '../lib/siteConfig.js'

const FEATURE_GROUPS = [
  {
    title: 'Desktop application',
    description: 'The free Electron app is where you run everything — no subscription required.',
    features: [
      {
        title: 'Windows & Linux',
        text: 'Native installers for Windows 10/11 and Linux desktop. Starter labs ship with the app; download more from the catalog.'
      },
      {
        title: 'Docker-powered labs',
        text: 'Real containers — not a simulator. Labs build and run locally with Docker (or WSL on Windows). Health checks guide you when something is missing.'
      },
      {
        title: 'Integrated terminal',
        text: 'Shell sessions attach directly to lab containers via docker exec — the same commands you use on the job, safely isolated from your host.'
      },
      {
        title: 'SSH sessions',
        text: 'Connect to lab targets over SSH with generated credentials. Practice remote administration the way teams actually work.'
      },
      {
        title: 'Desktop workstations',
        text: 'Optional GUI workstations (Linux and Windows terminal profiles) for labs that need a full desktop — browse files, run GUI tools, and investigate incidents.'
      },
      {
        title: 'Import lab packs',
        text: 'Download packs from this site or import a local .zip. Bundled, community, and online labs all appear in one list with filters.'
      }
    ]
  },
  {
    title: 'Learning & progress',
    description: 'Structured training with feedback, hints, and rewards that stay on your machine unless you choose to sync.',
    features: [
      {
        title: 'Structured objectives',
        text: 'Step-by-step goals with auto-checks for files, services, commands, and flags. Clear prompts tell you exactly what to submit.'
      },
      {
        title: 'Hints & validation',
        text: 'Unlock hints when you are stuck. Run validation inside the container to confirm fixes before moving on.'
      },
      {
        title: 'XP, levels & unlocks',
        text: 'Earn experience, level up, and unlock labs in order. Progress is stored locally in SQLite — yours by default.'
      },
      {
        title: 'Achievements',
        text: 'Collect badges as you complete scenarios and build practical sysadmin skills over time.'
      },
      {
        title: 'Safety mode',
        text: 'Labs run in isolated containers with guardrails. The app never runs destructive commands on your real operating system.'
      }
    ]
  },
  {
    title: 'Catalog & community',
    description: 'Browse, publish, and share scenarios — all optional extras on top of the free desktop app.',
    features: [
      {
        title: 'Lab catalog',
        text: 'Official and community scenarios covering Linux basics, permissions, services, nginx, disk cleanup, and more — with a roadmap toward 100+ labs.'
      },
      {
        title: 'Publish your labs',
        text: 'Authors can upload lab packs so others can download and learn from your scenarios.'
      },
      {
        title: 'Verified & community packs',
        text: 'Official and signed packs install without extra prompts. Community labs show a clear trust warning before you run them.'
      },
      {
        title: 'Free cloud account',
        text: 'Optional sign-in syncs progress across devices, links your desktop app, and lets you opt into the global leaderboard — no paywall.'
      },
      {
        title: 'Device linking',
        text: 'Connect the desktop app to your account with a simple device-code flow. Cloud sync is off until you enable it.'
      }
    ]
  },
  {
    title: 'For authors & developers',
    description: 'Build and test your own Docker labs without leaving the app.',
    features: [
      {
        title: 'Lab Builder',
        text: 'A 13-step wizard (Developer Mode) to draft Docker labs: objectives, filesystem, services, validation scripts, and export to folder or zip.'
      },
      {
        title: 'Build & test',
        text: 'Build Docker images and run validation from the builder before you publish — no XP awarded during test runs.'
      },
      {
        title: 'Schema & safety review',
        text: 'lab.json is validated against a shared schema. Scripts and Dockerfiles are scanned for risky patterns before export.'
      },
      {
        title: 'Open source codebase',
        text: 'The app, lab format, and registry API are open source under MPL-2.0. Fork it, self-host the registry, or contribute labs and code.'
      }
    ]
  }
]

export default function HomePage({ onBrowseLabs, onLinkDevice, onPublish, onSignIn, user }) {
  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__content">
          <div className="hero__badges">
            <span className="pill pill--accent">Free &amp; open source</span>
            <span className="pill">{LICENSE_NAME} license</span>
            <span className="pill">Windows &amp; Linux</span>
          </div>
          <p className="eyebrow">Computer Server Labs</p>
          <h1 id="hero-heading" className="hero__title">
            Hands-on system administration training — free forever
          </h1>
          <p className="hero__lead">
            A free, open-source desktop app for real Docker labs, terminals, SSH, and desktop workstations. No
            subscription, no paywall for core features — just download, install Docker, and start practicing. This site
            is your optional lab catalog, account, and community hub.
          </p>
          <div className="hero__actions">
            <DownloadAppButton className="btn btn-lg" />
            <button type="button" className="btn btn-lg btn-ghost" onClick={() => onBrowseLabs?.()}>
              Browse labs
            </button>
            <a
              href={GITHUB_REPO_URL}
              className="btn btn-ghost btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              View source
            </a>
            {!user ? (
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => onSignIn?.()}>
                Create free account
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="oss-band card" aria-labelledby="oss-heading">
        <div className="oss-band__content">
          <h2 id="oss-heading" className="oss-band__title">
            Open source, not open wallet
          </h2>
          <p className="oss-band__text">
            Computer Server Labs is{' '}
            <strong>free software</strong> released under the{' '}
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
              {LICENSE_NAME}
            </a>{' '}
            license. The desktop app, bundled starter labs, and source code cost nothing. You can inspect, fork, and
            self-host the registry API. Optional cloud accounts for sync and leaderboards are also free — they are not
            required to use the app.
          </p>
          <ul className="oss-band__list">
            <li>No subscription or license fee for the desktop app</li>
            <li>Starter labs included with every install</li>
            <li>Community catalog and lab publishing at no charge</li>
            <li>Source available on GitHub for transparency and contributions</li>
          </ul>
        </div>
        <div className="oss-band__actions">
          <DownloadAppButton className="btn" />
          <a href={GITHUB_REPO_URL} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
            GitHub repository
          </a>
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
              <h3 className="steps__title">Get the free desktop app</h3>
              <p className="steps__text">
                Install Computer Server Labs on Windows or Linux. Starter labs are bundled; the catalog adds more
                scenarios and updates at no cost.
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
                Explore the catalog for Linux, networking, containers, and everyday administration topics. Download a
                lab pack or import a zip into the app.
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
              <h3 className="steps__title">Practice — sync if you want</h3>
              <p className="steps__text">
                Complete objectives in real terminals and workstations. Link a free account only if you want cloud sync
                or the leaderboard — local progress works without signing in.
              </p>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => onLinkDevice?.()}>
                Link your app
              </button>
            </div>
          </li>
        </ol>
      </section>

      {FEATURE_GROUPS.map((group) => (
        <section key={group.title} className="features" aria-labelledby={`features-${group.title}`}>
          <h2 id={`features-${group.title}`} className="section-title">
            {group.title}
          </h2>
          <p className="section-lead">{group.description}</p>
          <ul className="features__grid">
            {group.features.map((f) => (
              <li key={f.title} className="feature-card">
                <h3 className="feature-card__title">{f.title}</h3>
                <p className="feature-card__text">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="cta-band card">
        <h2 className="cta-band__title">Ready to start?</h2>
        <p className="cta-band__text">
          {user
            ? 'Open the desktop app, pick a lab from the catalog, or share your own scenarios with the community — all free.'
            : 'Download the app for free, or create an optional account to sync progress, publish labs, and join the leaderboard.'}
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
          <a href={GITHUB_REPO_URL} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
        </div>
      </section>
    </div>
  )
}

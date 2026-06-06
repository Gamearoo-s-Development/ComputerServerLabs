import React, { useCallback, useEffect, useState } from 'react'
import { api, clearSession, saveSession } from './api/client.js'
import HomePage from './pages/HomePage.jsx'
import LabsPage from './pages/LabsPage.jsx'
import LabDetailPage from './pages/LabDetailPage.jsx'
import PublishLabPage from './pages/PublishLabPage.jsx'
import LinkDevicePage from './pages/LinkDevicePage.jsx'
import LeaderboardPage from './pages/LeaderboardPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import UnsubscribePage from './pages/UnsubscribePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import { GITHUB_REPO_URL, LICENSE_NAME, LICENSE_URL } from './lib/siteConfig.js'

const SITE_NOTICE_KEY = 'sgq_site_notice'

function readStoredSiteNotice() {
  try {
    const raw = sessionStorage.getItem(SITE_NOTICE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function readRouteFromUrl() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const params = new URLSearchParams(window.location.search)
  if (path.endsWith('/verify-email') || path === '/verify-email') {
    return { page: 'verify-email', token: params.get('token') }
  }
  if (path.endsWith('/unsubscribe') || path === '/unsubscribe') {
    return {
      page: 'unsubscribe',
      token: params.get('token'),
      scope: params.get('scope')
    }
  }
  if (path.endsWith('/link-device') || path === '/link-device') {
    return { page: 'link-device', token: null }
  }
  if (path.endsWith('/forgot-password') || path === '/forgot-password') {
    return { page: 'forgot-password', token: null }
  }
  if (path.endsWith('/account') || path === '/account') {
    return { page: 'account', token: null }
  }
  if (path.endsWith('/publish') || path === '/publish') {
    return { page: 'publish', token: null }
  }
  if (path.endsWith('/labs') || path === '/labs') {
    return { page: 'labs', token: null }
  }
  if (path === '/' || path === '') {
    return { page: 'home', token: null }
  }
  return { page: 'home', token: null }
}

export default function App() {
  const initial = readRouteFromUrl()
  const [page, setPage] = useState(initial.page)
  const [verifyToken, setVerifyToken] = useState(initial.page === 'verify-email' ? initial.token : null)
  const [unsubscribeToken, setUnsubscribeToken] = useState(initial.page === 'unsubscribe' ? initial.token : null)
  const [unsubscribeScope, setUnsubscribeScope] = useState(initial.page === 'unsubscribe' ? initial.scope : null)
  const [labId, setLabId] = useState(null)
  const [user, setUser] = useState(null)
  const [siteNotice, setSiteNotice] = useState(() => readStoredSiteNotice())

  useEffect(() => {
    const route = readRouteFromUrl()
    setPage(route.page)
    if (route.page === 'verify-email') setVerifyToken(route.token)
    if (route.page === 'unsubscribe') {
      setUnsubscribeToken(route.token)
      setUnsubscribeScope(route.scope)
    }
  }, [])

  function showSiteNotice(notice) {
    sessionStorage.setItem(SITE_NOTICE_KEY, JSON.stringify(notice))
    setSiteNotice(notice)
  }

  function dismissSiteNotice() {
    sessionStorage.removeItem(SITE_NOTICE_KEY)
    setSiteNotice(null)
  }

  const handleUnsubscribeComplete = useCallback((result) => {
    const already = result.alreadyUnsubscribed === true
    showSiteNotice({
      type: 'success',
      title: already ? 'Already unsubscribed' : 'Email preferences updated',
      message: already
        ? `You were already unsubscribed from ${result.scopeLabel ?? 'these emails'}.`
        : `You have been unsubscribed from ${result.scopeLabel ?? 'these emails'}.`,
      email: result.email ?? null,
      scopeLabel: result.scopeLabel ?? null
    })
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('sgq_access_token')
    if (!token) return
    api('/api/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => clearSession())
  }, [])

  function navigate(next, id = null) {
    setPage(next)
    setLabId(id)
    if (next !== 'verify-email') {
      setVerifyToken(null)
    }
    if (next !== 'unsubscribe') {
      setUnsubscribeToken(null)
      setUnsubscribeScope(null)
    }
  }

  async function logout() {
    clearSession()
    setUser(null)
    navigate('home')
  }

  async function resendVerification() {
    if (!user?.email) return
    try {
      const res = await api('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: user.email })
      })
      alert(res.message ?? 'If your account is unverified, check your inbox.')
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="layout">
      <SiteHeader
        page={page}
        user={user}
        onNavigate={(next) => navigate(next)}
        onLogout={() => void logout()}
        onResendVerification={() => void resendVerification()}
      />

      {siteNotice ? (
        <div
          className={`site-notice site-notice--${siteNotice.type === 'error' ? 'error' : 'success'}`}
          role="status"
          aria-live="polite"
        >
          <div className="site-notice__body">
            <p className="site-notice__title">{siteNotice.title}</p>
            <p className="site-notice__message">{siteNotice.message}</p>
            {siteNotice.email ? (
              <p className="site-notice__detail">
                Account: <strong>{siteNotice.email}</strong>
              </p>
            ) : null}
          </div>
          <button type="button" className="site-notice__dismiss btn-ghost btn" onClick={dismissSiteNotice}>
            Dismiss
          </button>
        </div>
      ) : null}

      {page === 'home' ? (
        <HomePage
          user={user}
          onBrowseLabs={() => navigate('labs')}
          onLinkDevice={() => navigate('link-device')}
          onPublish={() => navigate('publish')}
          onSignIn={() => navigate('login')}
        />
      ) : null}
      {page === 'labs' ? <LabsPage onOpen={(id) => navigate('lab', id)} /> : null}
      {page === 'lab' && labId ? <LabDetailPage labId={labId} onBack={() => navigate('labs')} /> : null}
      {page === 'publish' ? (
        <PublishLabPage
          user={user}
          onRequireLogin={() => navigate('login')}
          onPublished={(id) => navigate('lab', id)}
        />
      ) : null}
      {page === 'link-device' ? (
        <LinkDevicePage
          onAuthed={(tokens) => {
            saveSession(tokens)
            setUser(tokens.user)
          }}
        />
      ) : null}
      {page === 'leaderboard' ? <LeaderboardPage user={user} /> : null}
      {page === 'account' ? (
        <AccountPage
          user={user}
          onRequireLogin={() => navigate('login')}
          onPublish={() => navigate('publish')}
        />
      ) : null}
      {page === 'login' ? (
        <LoginPage
          onAuthed={(tokens) => {
            saveSession(tokens)
            setUser(tokens.user)
            navigate('home')
          }}
          onForgotPassword={() => navigate('forgot-password')}
        />
      ) : null}
      {page === 'forgot-password' ? <ForgotPasswordPage onBackToLogin={() => navigate('login')} /> : null}
      {page === 'verify-email' ? (
        <VerifyEmailPage token={verifyToken} onDone={(next) => navigate(next ?? 'home')} />
      ) : null}
      {page === 'unsubscribe' ? (
        <UnsubscribePage
          token={unsubscribeToken}
          scope={unsubscribeScope}
          onComplete={handleUnsubscribeComplete}
          onDone={(next) => navigate(next ?? 'home')}
        />
      ) : null}

      <footer className="site-footer">
        <p>&copy; {new Date().getFullYear()} Computer Server Labs</p>
        <p className="site-footer__note">
          Free, open-source hands-on sysadmin training. Licensed under{' '}
          <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
            {LICENSE_NAME}
          </a>
          .{' '}
          <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}

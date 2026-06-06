/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('sgq_refresh_token')
  if (!refreshToken) return false
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.accessToken) {
    clearSession()
    return false
  }
  localStorage.setItem('sgq_access_token', data.accessToken)
  if (data.user) {
    localStorage.setItem('sgq_user', JSON.stringify(data.user))
  }
  return true
}

export async function apiUpload(path, formData) {
  const token = localStorage.getItem('sgq_access_token')
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  let res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData })
  let data = await res.json().catch(() => ({}))

  if (res.status === 401 && token) {
    const renewed = await refreshAccessToken()
    if (renewed) {
      const retryHeaders = {
        Authorization: `Bearer ${localStorage.getItem('sgq_access_token')}`
      }
      res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: retryHeaders, body: formData })
      data = await res.json().catch(() => ({}))
    }
  }

  if (!res.ok) throw new Error(data.error ?? res.statusText)
  return data
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('sgq_access_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  let res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  let data = await res.json().catch(() => ({}))

  if (res.status === 401 && token && !options.skipRefresh) {
    const renewed = await refreshAccessToken()
    if (renewed) {
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${localStorage.getItem('sgq_access_token')}`
      }
      res = await fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders, skipRefresh: true })
      data = await res.json().catch(() => ({}))
    }
  }

  if (!res.ok) throw new Error(data.error ?? res.statusText)
  return data
}

export function saveSession(tokens) {
  localStorage.setItem('sgq_access_token', tokens.accessToken)
  if (tokens.refreshToken) localStorage.setItem('sgq_refresh_token', tokens.refreshToken)
  if (tokens.user) localStorage.setItem('sgq_user', JSON.stringify(tokens.user))
}

export function clearSession() {
  localStorage.removeItem('sgq_access_token')
  localStorage.removeItem('sgq_refresh_token')
  localStorage.removeItem('sgq_user')
}

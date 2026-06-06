/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getApi } from '../hooks/useApi.js'
import { cn } from '../utils/cn.js'

const NotificationContext = createContext(null)

const TONE_STYLES = {
  info: 'border-accent/40 shadow-glow',
  success: 'border-success/40',
  warning: 'border-warning/40',
  danger: 'border-danger/40',
  error: 'border-danger/40',
  achievement: 'border-success/50 shadow-glow bg-success/5',
  xp: 'border-accent/50 shadow-glow bg-accent/5'
}

/**
 * @param {{ toast: object, onDismiss: (id: string) => void }} props
 */
function Toast({ toast, onDismiss }) {
  const tone = toast.tone ?? 'info'
  const style = TONE_STYLES[tone] ?? TONE_STYLES.info

  useEffect(() => {
    const duration = tone === 'achievement' || tone === 'xp' ? 6500 : 5200
    const timer = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss, tone])

  const icon =
    tone === 'achievement'
      ? '🏆 '
      : tone === 'xp'
        ? '✨ '
        : tone === 'success'
          ? '✓ '
          : tone === 'warning'
            ? '⚠ '
            : tone === 'danger' || tone === 'error'
              ? '✕ '
              : ''

  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-sm animate-fade-in rounded-lg border bg-card/95 p-4 backdrop-blur-md',
        'translate-x-0 transition-transform duration-300',
        style
      )}
      role="status"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">
        {icon}
        {toast.title}
      </p>
      {toast.body ? <p className="mt-1 text-sm text-gray-300">{toast.body}</p> : null}
    </div>
  )
}

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback((payload) => {
    const tone = payload.tone ?? 'info'
    const toast = {
      id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: payload.title,
      body: payload.body ?? '',
      tone: tone === 'danger' ? 'error' : tone
    }
    setToasts((current) => [toast, ...current].slice(0, 5))
  }, [])

  useEffect(() => {
    const api = getApi()
    if (!api?.progress?.consumeNotifications) return undefined

    let cancelled = false

    async function pull() {
      const result = await api.progress.consumeNotifications()
      if (cancelled || !result?.ok) return
      for (const note of result.data ?? []) {
        const tone =
          note.title === 'Achievement unlocked'
            ? 'achievement'
            : note.title === 'Lab complete'
              ? 'xp'
              : note.tone ?? 'info'
        notify({ title: note.title, body: note.body, tone })
      }
    }

    pull()
    const timer = setInterval(pull, 8000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [notify])

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(100%,22rem)] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}

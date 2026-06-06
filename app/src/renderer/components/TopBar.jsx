/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { useAppState } from '../context/AppStateContext.jsx'
import SafetyBadge from './safety/SafetyBadge.jsx'
import LiveStatusPills from './dashboard/LiveStatusPills.jsx'

/**
 * @param {{ pageTitle: string, onMenuClick?: () => void }} props
 */
export default function TopBar({ pageTitle, onMenuClick }) {
  const { loading } = useAppState()

  return (
    <header className="shrink-0 border-b border-border bg-background-elevated/60 backdrop-blur-md">
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {onMenuClick ? (
            <button
              type="button"
              onClick={onMenuClick}
              className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-card lg:hidden"
              aria-label="Open navigation menu"
            >
              ☰
            </button>
          ) : null}
          <h1 className="font-display text-lg font-semibold text-white sm:text-xl">{pageTitle}</h1>
          <SafetyBadge compact className="hidden sm:inline-flex" />
          {loading ? (
            <span className="ml-auto hidden text-xs text-accent sm:inline">Scanning system…</span>
          ) : (
            <span className="ml-auto hidden items-center gap-1.5 text-xs text-success sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              Live
            </span>
          )}
        </div>

        <LiveStatusPills compact />
      </div>
    </header>
  )
}

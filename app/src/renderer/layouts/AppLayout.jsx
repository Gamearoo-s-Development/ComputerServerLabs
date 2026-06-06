/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState } from 'react'
import AnimatedBackground from '../components/AnimatedBackground.jsx'
import Sidebar, { getNavItems } from '../components/Sidebar.jsx'
import TopBar from '../components/TopBar.jsx'
import { APP_VERSION_LABEL } from '../constants/version.js'
import IpcConnectionStatus from '../components/IpcConnectionStatus.jsx'

const PAGE_TITLES = {
  ...Object.fromEntries(
    getNavItems(true).map((item) => [item.id, item.label])
  )
}

/**
 * @param {{
 *   activePage: string
 *   onNavigate: (id: string) => void
 *   developerMode?: boolean
 *   children: React.ReactNode
 * }} props
 */
export default function AppLayout({ activePage, onNavigate, developerMode = false, children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const navItems = getNavItems(developerMode)
  const pageTitle = PAGE_TITLES[activePage] ?? 'Dashboard'

  return (
    <div className="relative flex min-h-screen flex-col">
      <AnimatedBackground />

      <div className="relative z-10 flex min-h-screen flex-1 opacity-0 animate-fade-in">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex">
          <Sidebar
            items={navItems}
            activeId={activePage}
            onNavigate={onNavigate}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          />
        </div>

        {/* Mobile drawer */}
        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close navigation menu"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative z-50 h-full shadow-2xl">
              <Sidebar
                items={navItems}
                activeId={activePage}
                onNavigate={(id) => {
                  onNavigate(id)
                  setMobileNavOpen(false)
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar pageTitle={pageTitle} onMenuClick={() => setMobileNavOpen(true)} />

          <main className="flex flex-1 flex-col overflow-auto p-4 sm:p-6">{children}</main>

          <footer className="shrink-0 border-t border-border px-4 py-2 sm:px-6">
            <p className="text-xs text-muted-dim">{APP_VERSION_LABEL}</p>
            <IpcConnectionStatus />
          </footer>
        </div>
      </div>
    </div>
  )
}

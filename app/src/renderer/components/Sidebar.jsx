/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { cn } from '../utils/cn.js'

/** @type {{ id: string, label: string, icon: string }[]} */
import { GAME_UI } from '../constants/gameTone.js'

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '▣' },
  { id: 'labs', label: GAME_UI.labsNav, icon: '⬡' },
  { id: 'online-labs', label: 'Online Labs', icon: '☁' },
  { id: 'account', label: 'Account', icon: '◉' },
  { id: 'command-guide', label: GAME_UI.commandCodex, icon: '⌘' },
  { id: 'progress', label: GAME_UI.playerProgress, icon: '◎' },
  { id: 'achievements', label: 'Achievements', icon: '★' },
  { id: 'tools', label: GAME_UI.systemScan, icon: '⚙' },
  { id: 'settings', label: 'Settings', icon: '☰' }
]

export const LAB_BUILDER_NAV_ITEM = { id: 'lab-builder', label: 'Lab Builder', icon: '⌬' }

/**
 * @param {boolean} [developerMode]
 * @returns {{ id: string, label: string, icon: string }[]}
 */
export function getNavItems(developerMode = false) {
  if (!developerMode) return NAV_ITEMS
  const i = NAV_ITEMS.findIndex((n) => n.id === 'labs')
  if (i < 0) return [...NAV_ITEMS, LAB_BUILDER_NAV_ITEM]
  return [...NAV_ITEMS.slice(0, i + 1), LAB_BUILDER_NAV_ITEM, ...NAV_ITEMS.slice(i + 1)]
}

/**
 * @param {{
 *   activeId: string
 *   onNavigate: (id: string) => void
 *   collapsed?: boolean
 *   onToggleCollapse?: () => void
 *   items?: { id: string, label: string, icon: string }[]
 * }} props
 */
export default function Sidebar({ activeId, onNavigate, collapsed = false, onToggleCollapse, items = NAV_ITEMS }) {
  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-background-elevated/70 backdrop-blur-md',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-[4.25rem]' : 'w-56 lg:w-60'
      )}
    >
      <div
        className={cn(
          'flex items-center border-b border-border',
          collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2'
        )}
      >
        <img
          src={collapsed ? '/icon.png' : '/logo.png'}
          alt={GAME_UI.appName}
          className={cn(
            'm-0 block shrink-0 border-0 bg-transparent p-0 object-contain object-left',
            collapsed ? 'h-9 w-9' : 'h-9 w-auto max-w-[11.5rem]'
          )}
          onError={(e) => {
            e.currentTarget.src = '/icon.png'
            e.currentTarget.className = 'm-0 block h-9 w-9 shrink-0 border-0 bg-transparent p-0 object-contain'
          }}
        />
        <p className="sr-only">{GAME_UI.appName}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Main navigation">
        {items.map((item) => {
          const active = activeId === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                active
                  ? 'bg-accent/15 text-accent border border-accent/25'
                  : 'text-muted hover:bg-card/80 hover:text-gray-200 border border-transparent',
                collapsed && 'justify-center px-2'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {item.icon}
              </span>
              {!collapsed ? <span>{item.label}</span> : null}
            </button>
          )
        })}
      </nav>

      {onToggleCollapse ? (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-full rounded-lg px-3 py-2 text-xs text-muted transition-colors hover:bg-card hover:text-gray-200"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '»' : '« Collapse'}
          </button>
        </div>
      ) : null}
    </aside>
  )
}

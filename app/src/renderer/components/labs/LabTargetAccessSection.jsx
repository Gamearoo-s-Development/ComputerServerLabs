/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback } from 'react'
import { Button } from '../ui/index.js'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { GAME_UI } from '../../constants/gameTone.js'
import { writeClipboardText } from '../../utils/clipboard.js'

/**
 * Lab target SSH credentials — use from inside the workstation.
 * @param {{
 *   routes?: object[]
 *   username?: string | null
 *   password?: string | null
 *   sshReady?: boolean
 *   helperSshReady?: boolean
 *   hideSection?: boolean
 *   discoverMode?: boolean
 * }} props
 */
export default function LabTargetAccessSection({
  routes = [],
  username,
  password,
  sshReady,
  helperSshReady,
  hideSection = false,
  discoverMode = false
}) {
  const { notify } = useNotifications()

  const copyText = useCallback(
    async (text, label) => {
      if (!text) return
      try {
        await writeClipboardText(text)
        notify({ title: 'Copied', body: label, tone: 'info' })
      } catch {
        notify({ title: 'Copy failed', body: 'Could not access the clipboard.', tone: 'warning' })
      }
    },
    [notify]
  )

  const copyRouteCredentials = useCallback(
    (route) => {
      const routeUsername = route.username ?? username
      const routePassword = route.password ?? password
      const lines = [`${GAME_UI.host}: ${route.host}`, `${GAME_UI.port}: ${route.port}`]
      if (routeUsername) lines.push(`${GAME_UI.username}: ${routeUsername}`)
      if (routePassword) lines.push(`${GAME_UI.password}: ${routePassword}`)
      if (route.command) lines.push(`SSH: ${route.command}`)
      void copyText(lines.join('\n'), 'Lab target credentials')
    },
    [copyText, password, username]
  )

  if (hideSection || routes.length === 0) {
    return routes.length === 0 && !hideSection ? (
      <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
          {discoverMode ? GAME_UI.targetServicesTitle : GAME_UI.labTargetAccess}
        </h3>
        <p className="mt-2 text-xs text-muted">Awaiting lab network and published ports…</p>
      </section>
    ) : null
  }

  const sectionTitle = discoverMode ? GAME_UI.targetServicesTitle : GAME_UI.labTargetAccess
  const sectionNote = discoverMode ? GAME_UI.discoverModeNote : GAME_UI.labTargetAccessNote

  return (
    <section className="rounded-lg border border-border bg-background-elevated/40 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">{sectionTitle}</h3>
      <p className="mt-2 text-xs text-muted">{sectionNote}</p>

      {discoverMode ? (
        <p className="mt-2 text-xs text-warning">{GAME_UI.discoverModeSshHint}</p>
      ) : null}

      {sshReady === false && helperSshReady === false ? (
        <p className="mt-2 text-xs text-warning">SSH is still starting — wait a moment before connecting.</p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {routes.map((route) => {
          const showCredentials =
            !discoverMode && route.showCredentials !== false && (route.username || username)
          return (
            <li
              key={route.context}
              className="rounded-md border border-border/60 bg-background/30 px-3 py-2"
            >
              {routes.length > 1 ? (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">{route.label}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                {showCredentials ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => copyText(route.username ?? username, 'Username')}>
                      Copy username
                    </Button>
                    {(route.password || password) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyText(route.password ?? password, 'Password')}
                      >
                        Copy password
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="sm" onClick={() => copyRouteCredentials(route)}>
                      Copy all
                    </Button>
                  </>
                ) : null}
              </div>
              <dl className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">{GAME_UI.host}</dt>
                  <dd className="font-mono text-gray-200">{route.host}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">{GAME_UI.port}</dt>
                  <dd className="font-mono text-gray-200">{route.port}</dd>
                </div>
                {showCredentials ? (
                  <>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">{GAME_UI.username}</dt>
                      <dd className="font-mono text-gray-200">{route.username ?? username}</dd>
                    </div>
                    {route.password || password ? (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted">{GAME_UI.password}</dt>
                        <dd className="font-mono text-gray-200">{route.password ?? password}</dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </dl>
              {showCredentials && route.command ? (
                <div className="mt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">
                      SSH command
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyText(route.command, 'SSH command')}
                    >
                      Copy
                    </Button>
                  </div>
                  <code className="mt-1 block break-all font-mono text-[11px] text-gray-200">
                    {route.command}
                  </code>
                </div>
              ) : null}
              {route.accessHint ? (
                <p className="mt-2 text-[10px] text-muted-dim">{route.accessHint}</p>
              ) : null}
              {route.hint ? <p className="mt-2 text-[10px] text-muted-dim">{route.hint}</p> : null}
              {route.networkAlias ? (
                <div className="mt-2 flex justify-between gap-2 text-[10px] text-muted-dim">
                  <span>Alias</span>
                  <span className="font-mono text-gray-300">{route.networkAlias}</span>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {!discoverMode && routes.some((r) => r.command) ? (
        <p className="mt-2 text-[11px] text-muted-dim">{GAME_UI.missionCredentialsNote}</p>
      ) : null}
    </section>
  )
}

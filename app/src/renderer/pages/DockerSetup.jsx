/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { Button, Card, SectionTitle } from '../components/ui/index.js'
import WhySafeSection from '../components/safety/WhySafeSection.jsx'
import { getApi } from '../hooks/useApi.js'

/**
 * @param {{ onNavigate: (id: string) => void }} props
 */
export default function DockerSetup({ onNavigate }) {
  async function openUrl(url) {
    const api = getApi()
    if (api?.app?.openExternal) {
      await api.app.openExternal(url)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <SectionTitle
        eyebrow="Setup"
        title="Docker Setup"
        description="Install and verify Docker before starting container labs."
        action={
          <Button variant="secondary" size="sm" onClick={() => onNavigate('tools')}>
            Open System Scan
          </Button>
        }
      />

      <Card>
        <h3 className="text-sm font-semibold text-white">Windows</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Install Docker Desktop from the official site.</li>
          <li>Enable WSL 2 backend when prompted.</li>
          <li>Launch Docker Desktop and wait until the engine is running.</li>
          <li>Return here and run System Scan.</li>
        </ol>
        <Button className="mt-4" variant="primary" size="sm" onClick={() => openUrl('https://docs.docker.com/desktop/setup/install/windows-install/')}>
          Windows install guide
        </Button>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-white">Linux</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Install Docker Engine for your distribution.</li>
          <li>Add your user to the <code className="text-accent">docker</code> group if needed.</li>
          <li>Start the service: <code className="text-accent">sudo systemctl start docker</code></li>
        </ol>
        <Button className="mt-4" variant="primary" size="sm" onClick={() => openUrl('https://docs.docker.com/engine/install/')}>
          Linux install guide
        </Button>
      </Card>

      <WhySafeSection />
    </div>
  )
}

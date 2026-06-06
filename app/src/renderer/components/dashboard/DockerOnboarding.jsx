/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { useAppState } from '../../context/AppStateContext.jsx'
import { getApi } from '../../hooks/useApi.js'
import Button from '../ui/Button.jsx'
import Card from '../ui/Card.jsx'

/**
 * @param {{ onNavigate: (id: string) => void }} props
 */
export default function DockerOnboarding({ onNavigate }) {
  const { status } = useAppState()
  const docker = status?.docker ?? status?.healthChecks?.find((c) => c.id === 'docker')

  if (!docker || docker.status === 'installed' || docker.status === 'running') {
    return null
  }

  const isMissing = docker.status === 'missing'
  const title = isMissing ? 'Docker required' : 'Docker engine stopped'
  const body = isMissing
    ? 'Lab containers need a local Docker installation. Open Setup to configure your environment, then run a system scan.'
    : 'The Docker engine is installed but not running. Start it from your system tray or services, then verify in Health Checks.'

  async function openDockerDocs() {
    const url = 'https://docs.docker.com/get-docker/'
    const api = getApi()
    if (api?.app?.openExternal) {
      await api.app.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener')
    }
  }

  return (
    <Card className="border-warning/30 bg-warning/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-warning">{title}</p>
          <p className="mt-1 text-sm text-muted">{body}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={openDockerDocs}>
            {isMissing ? 'Setup guide' : 'Engine docs'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('setup/docker')}>
            Environment setup
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('tools')}>
            System scan
          </Button>
        </div>
      </div>
    </Card>
  )
}

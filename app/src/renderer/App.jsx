/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useState } from 'react'
import { AppStateProvider, useAppState } from './context/AppStateContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import { OnboardingProvider } from './context/OnboardingContext.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import Achievements from './pages/Achievements.jsx'
import Dashboard from './pages/Dashboard.jsx'
import DockerSetup from './pages/DockerSetup.jsx'
import Labs from './pages/Labs.jsx'
import Progress from './pages/Progress.jsx'
import Settings from './pages/Settings.jsx'
import Tools from './pages/Tools.jsx'
import LabBuilder from './pages/LabBuilder.jsx'
import CommandGuide from './pages/CommandGuide.jsx'
import OnlineLabs from './pages/OnlineLabs.jsx'
import Account from './pages/Account.jsx'
import StaleLabResourcesModal from './components/labs/StaleLabResourcesModal.jsx'
import { getApi } from './hooks/useApi.js'

function AppRoutes() {
  const [activePage, setActivePage] = useState('dashboard')
  const [staleScan, setStaleScan] = useState(null)
  const { profile } = useAppState()
  const developerMode = profile?.settings?.developerMode === true

  useEffect(() => {
    const api = getApi()
    void api?.app?.getStaleLabResources?.().then((result) => {
      if (result?.ok && result.data?.found) {
        setStaleScan(result.data)
      }
    })
  }, [])

  useEffect(() => {
    if (!developerMode && activePage === 'lab-builder') {
      setActivePage('dashboard')
    }
  }, [developerMode, activePage])

  function navigate(page) {
    setActivePage(page)
    const api = getApi()
    const pageMap = {
      dashboard: { page: 'dashboard' },
      labs: { page: 'labs' },
      'online-labs': { page: 'online-labs' },
      account: { page: 'account' },
      progress: { page: 'progress' },
      achievements: { page: 'achievements' },
      tools: { page: 'tools' },
      settings: { page: 'settings' },
      'setup/docker': { page: 'tools' },
      'lab-builder': { page: 'labs', context: 'builder' },
      'command-guide': { page: 'command-guide' }
    }
    void api?.discord?.updatePresence?.(pageMap[page] ?? { page: 'labs' })
  }

  function renderPage() {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} />
      case 'labs':
        return <Labs onNavigate={navigate} />
      case 'online-labs':
        return <OnlineLabs />
      case 'account':
        return <Account />
      case 'progress':
        return <Progress />
      case 'achievements':
        return <Achievements />
      case 'tools':
        return <Tools />
      case 'settings':
        return <Settings onNavigate={navigate} />
      case 'setup/docker':
        return <DockerSetup onNavigate={navigate} />
      case 'command-guide':
        return <CommandGuide />
      case 'lab-builder':
        return developerMode ? <LabBuilder onNavigate={navigate} /> : null
      default:
        return <Dashboard onNavigate={navigate} />
    }
  }

  return (
    <AppLayout activePage={activePage} onNavigate={navigate} developerMode={developerMode}>
      <div key={activePage} className="page-enter">
        {renderPage()}
      </div>
      <StaleLabResourcesModal
        open={Boolean(staleScan?.found)}
        scan={staleScan}
        onClose={() => setStaleScan(null)}
        onResolved={() => setStaleScan(null)}
      />
    </AppLayout>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <NotificationProvider>
        <OnboardingProvider>
          <AppRoutes />
        </OnboardingProvider>
      </NotificationProvider>
    </AppStateProvider>
  )
}

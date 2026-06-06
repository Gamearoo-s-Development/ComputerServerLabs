/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import ActivityFeed from '../components/dashboard/ActivityFeed.jsx'
import DashboardGreeting from '../components/dashboard/DashboardGreeting.jsx'
import DashboardToolbar from '../components/dashboard/DashboardToolbar.jsx'
import DockerOnboarding from '../components/dashboard/DockerOnboarding.jsx'
import LabCategoryGrid from '../components/dashboard/LabCategoryGrid.jsx'
import LiveStatusPills from '../components/dashboard/LiveStatusPills.jsx'
import PhaseRoadmap from '../components/dashboard/PhaseRoadmap.jsx'
import ProgressionOverview from '../components/dashboard/ProgressionOverview.jsx'
import QuickActions from '../components/dashboard/QuickActions.jsx'
import TerminalWidget from '../components/dashboard/TerminalWidget.jsx'

/**
 * @param {{ onNavigate: (id: string) => void }} props
 */
export default function Dashboard({ onNavigate }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <DashboardGreeting />
        <DashboardToolbar />
      </div>

      <LiveStatusPills />

      <DockerOnboarding onNavigate={onNavigate} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <TerminalWidget />
          <QuickActions onNavigate={onNavigate} />
          <LabCategoryGrid onNavigate={onNavigate} />
        </div>
        <div className="space-y-4">
          <ProgressionOverview onNavigate={onNavigate} />
          <ActivityFeed />
          <PhaseRoadmap />
        </div>
      </div>
    </div>
  )
}

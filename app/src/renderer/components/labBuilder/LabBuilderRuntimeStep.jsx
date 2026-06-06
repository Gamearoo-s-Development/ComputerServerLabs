/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { Card } from '../ui/index.js'

/**
 * @param {{ formLab: object, applyLabUpdate: (lab: object) => void, children?: React.ReactNode }} props
 */
export default function LabBuilderRuntimeStep({ formLab, applyLabUpdate, children }) {
  const layout = formLab.docker?.layout ?? 'single'

  function setLayout(next) {
    applyLabUpdate({
      ...formLab,
      docker: {
        ...(formLab.docker ?? {}),
        layout: next,
        composeServices:
          next === 'compose'
            ? formLab.docker?.composeServices ?? [
                {
                  id: 'target',
                  name: 'target',
                  primary: true,
                  build: { context: '.', dockerfile: 'Dockerfile' }
                }
              ]
            : formLab.docker?.composeServices
      }
    })
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Container layout</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-200">
            <input
              type="radio"
              name="docker-layout"
              checked={layout === 'single'}
              onChange={() => setLayout('single')}
            />
            Single container (Dockerfile + entrypoint.sh)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-200">
            <input
              type="radio"
              name="docker-layout"
              checked={layout === 'compose'}
              onChange={() => setLayout('compose')}
            />
            Multi-container (docker-compose.yml)
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">
          {layout === 'compose'
            ? 'Compose labs generate docker-compose.yml plus per-service Dockerfiles when needed. Mission host still orchestrates the primary target service.'
            : 'Most labs use one target container built from the generated Dockerfile.'}
        </p>
      </Card>
      {children}
    </div>
  )
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { Button, Card } from '../ui/index.js'

/**
 * @param {{
 *   onSave: () => void
 *   onExportFolder: () => void
 *   onExportZip: () => void
 *   onPublishToRegistry: () => void
 *   onBuildTest: () => void
 *   working: boolean
 *   scan: object | null
 *   onlineLinked?: boolean
 * }} props
 */
export default function LabBuilderSaveExportStep({
  onSave,
  onExportFolder,
  onExportZip,
  onPublishToRegistry,
  onBuildTest,
  working,
  scan,
  onlineLinked = false
}) {
  const blocked = scan?.safety?.hasBlocked === true

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <p className="text-sm text-gray-200">Save & export lab pack</p>
        <p className="mt-2 text-xs text-muted">
          Export creates a portable folder or zip with lab.json, Dockerfile, entrypoint.sh, files/, workstation/, and
          attachments/ — ready for the catalog or sharing.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" size="sm" disabled={working} onClick={onSave}>
            Save draft
          </Button>
          <Button variant="secondary" size="sm" disabled={working || blocked} onClick={onExportFolder}>
            Export folder…
          </Button>
          <Button variant="secondary" size="sm" disabled={working || blocked} onClick={onExportZip}>
            Export zip…
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={working || blocked || scan?.schemaValid !== true || !onlineLinked}
            onClick={onPublishToRegistry}
            title={
              !onlineLinked
                ? 'Link your account under Account first'
                : blocked
                  ? 'Resolve safety blocks first'
                  : 'Upload to the lab registry website'
            }
          >
            Publish to registry
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={working || blocked || scan?.schemaValid !== true}
            onClick={onBuildTest}
            title={blocked ? 'Resolve safety blocks first' : undefined}
          >
            Build/Test (Docker)
          </Button>
        </div>
        {!onlineLinked ? (
          <p className="mt-3 text-xs text-muted">
            Link your account (Account → Link Account) to publish community labs to the registry website.
          </p>
        ) : null}
        {blocked ? (
          <p className="mt-3 text-xs text-warning">Resolve blocked safety issues on the Safety Review step first.</p>
        ) : null}
      </Card>
      <Card className="!p-4">
        <p className="text-xs font-semibold uppercase text-muted-dim">Lab pack layout</p>
        <pre className="mt-2 font-mono text-[10px] text-muted">
{`lab-id/
├── lab.json
├── Dockerfile
├── docker-compose.yml   (multi-container only)
├── entrypoint.sh
├── validate.sh
├── files/
├── workstation/
├── attachments/
└── README.md`}
        </pre>
      </Card>
    </div>
  )
}

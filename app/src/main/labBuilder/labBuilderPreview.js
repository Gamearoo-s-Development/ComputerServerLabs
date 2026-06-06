/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { classifyDockerImageTrust } from '../dockerImageTrust.js'
import { analyzeLabDraftSafety } from '../labBuilderSafety.js'
import {
  collectPackages,
  generateDockerfile,
  generateEntrypointSh,
  resolveBaseImage,
  buildFilesManifest
} from './labBuilderGenerate.js'
import { OFFICIAL_BASE_IMAGES, SERVICE_CATALOG } from './labBuilderConstants.js'
import { buildTemplateContext, renderTemplateString } from './labTemplateVariables.js'
import {
  collectWorkstationPackages,
  generateWorkstationDockerfile,
  generateWorkstationEntrypointSh,
  buildWorkstationFilesManifest,
  resolveWorkstationBaseImage
} from './labBuilderWorkstationGenerate.js'
import {
  isCustomWorkstationEnabled,
  resolveCustomWorkstationImageTag
} from '../workstation/workstationCustomProfile.js'
import { buildFilesystemTreePreview, syncFilesystemFields } from './labFilesystem.js'

/**
 * @param {object} lab
 * @param {{ redactSecrets?: boolean, dockerfile?: string, entrypoint?: string, validateSh?: string, readme?: string }} [options]
 */
export function buildLabBuilderPreview(lab, options = {}) {
  const redact = options.redactSecrets !== false
  const ctx = buildTemplateContext({
    labId: lab.id,
    username: 'labuser_preview',
    password: redact ? undefined : 'preview-password',
    trainingFlag: redact ? undefined : 'SGQ-PREVIEW-1234'
  })

  const baseImage = resolveBaseImage(lab)
  const packages = collectPackages(lab)
  const services = (lab.docker?.services ?? []).map((id) => ({
    id,
    ...(SERVICE_CATALOG[id] ?? { label: id })
  }))
  const ports = lab.docker?.ports ?? []
  const files = lab.files ?? []
  const directories = lab.directories ?? []
  const startup = lab.docker?.startupCommands ?? []

  const trust = classifyDockerImageTrust(lab.docker?.image ?? baseImage, {
    localBuild: lab.docker?.imageSource === 'local-build' || lab.docker?.builderGenerated === true
  })

  const workstationDockerfile =
    options.workstationDockerfile ??
    (isCustomWorkstationEnabled(lab) ? generateWorkstationDockerfile(lab) : '')

  const safety = analyzeLabDraftSafety(lab, {
    dockerfile: options.dockerfile ?? generateDockerfile(lab),
    entrypoint: options.entrypoint ?? generateEntrypointSh(lab),
    workstationDockerfile,
    validateSh: options.validateSh ?? '',
    readme: options.readme ?? ''
  })

  /** @type {string[]} */
  const summaryBullets = [
    `Base image: ${baseImage}`,
    packages.length ? `Packages installed: ${packages.join(', ')}` : 'No extra packages declared',
    services.length
      ? `Services: ${services.map((s) => s.label ?? s.id).join(', ')}`
      : 'Services: (none declared)',
    `Files: ${files.length} file(s), ${directories.length} directory(ies)`,
    ports.length
      ? `Ports exposed: ${ports.map((p) => `${p.label ?? p.purpose ?? 'port'} → container ${p.container ?? p.containerPort}`).join('; ')}`
      : 'Ports: (none — add SSH port 22 for terminal labs)',
    startup.length ? `Startup commands: ${startup.length}` : 'Startup commands: (none)',
    `Validation: ${lab.validation?.type ?? 'not set'}`
  ]

  const customWsEnabled = isCustomWorkstationEnabled(lab)
  /** @type {object | null} */
  let workstation = null
  if (customWsEnabled) {
    const wsPackages = collectWorkstationPackages(lab)
    const wsFiles = lab.workstation?.custom?.files ?? []
    const wsDirs = lab.workstation?.custom?.directories ?? []
    workstation = {
      enabled: true,
      image: resolveCustomWorkstationImageTag(lab),
      baseImage: resolveWorkstationBaseImage(lab),
      runtime: lab.workstation?.custom?.runtime ?? 'linux',
      packages: wsPackages,
      fileCount: wsFiles.length,
      directoryCount: wsDirs.length,
      summaryLine: `This lab will build a custom workstation with ${wsPackages.length} package(s) and ${wsFiles.length} file(s).`,
      renderedFiles: wsFiles.map((f) => ({
        ...f,
        path: renderTemplateString(f.path ?? '', ctx, { redactSecrets: redact }),
        contentPreview: renderTemplateString((f.content ?? '').slice(0, 500), ctx, { redactSecrets: redact }),
        stage: f.stage ?? 'runtime'
      }))
    }
    summaryBullets.push(workstation.summaryLine)
    summaryBullets.push(`Custom workstation image: ${workstation.image}`)
  }

  const renderedFiles = files.map((f) => ({
    ...f,
    path: renderTemplateString(f.path ?? '', ctx, { redactSecrets: redact }),
    contentPreview: renderTemplateString((f.content ?? '').slice(0, 500), ctx, { redactSecrets: redact }),
    stage: f.stage ?? (/\{\{/.test(`${f.path}${f.content}`) ? 'runtime' : 'build')
  }))

  const routePreview = ports
    .filter((p) => p.exposeToHost === true)
    .map((p) => ({
      label: p.label ?? p.purpose ?? `Port ${p.container ?? p.containerPort}`,
      url:
        (p.purpose === 'web' || p.purpose === 'http' || (p.container ?? p.containerPort) === 80)
          ? 'http://127.0.0.1:<host-port>'
          : `127.0.0.1:<host-port> (container ${p.container ?? p.containerPort}/${p.protocol ?? 'tcp'})`
    }))

  const labCopy = { ...lab }
  syncFilesystemFields(labCopy)
  const filesystemTree = buildFilesystemTreePreview(labCopy, {
    username: 'patchwolf42',
    redactSecrets: redact
  })

  return {
    filesystemTree,
    summaryBullets,
    baseImage,
    packages,
    services,
    ports,
    routePreview,
    files: renderedFiles,
    directories,
    startupCommands: startup,
    imageTrust: trust,
    safety,
    workstation,
    artifacts: {
      labJson: JSON.stringify(lab, null, 2),
      dockerfile: options.dockerfile ?? generateDockerfile(lab),
      entrypoint: options.entrypoint ?? generateEntrypointSh(lab),
      filesManifest: JSON.stringify(buildFilesManifest(lab), null, 2),
      workstationDockerfile: customWsEnabled ? workstationDockerfile : null,
      workstationEntrypoint: customWsEnabled
        ? options.workstationEntrypoint ?? generateWorkstationEntrypointSh(lab)
        : null,
      workstationFilesManifest: customWsEnabled
        ? JSON.stringify(buildWorkstationFilesManifest(lab), null, 2)
        : null
    },
    officialBases: OFFICIAL_BASE_IMAGES
  }
}

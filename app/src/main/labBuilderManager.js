/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { ensureDataDirectories, getDataLayout } from './dataDirectoryManager.js'
import { validateLabPayload, startDraftLabSession, stopLab, getSessionState } from './labManager.js'
import { analyzeLabDraftSafety } from './labBuilderSafety.js'
import { DOCKER_TEMPLATES } from './labBuilderTemplates.js'
import {
  applyMockWebsiteTemplate,
  syncGeneratedDraftArtifacts
} from './labBuilder/labBuilderGenerate.js'
import { syncGeneratedWorkstationArtifacts } from './labBuilder/labBuilderWorkstationGenerate.js'
import { isCustomWorkstationEnabled } from './workstation/workstationCustomProfile.js'
import { buildLabBuilderPreview } from './labBuilder/labBuilderPreview.js'
import { syncFilesystemFields } from './labBuilder/labFilesystem.js'
import { applyImportsToDraft } from './labBuilder/labBuilderImportFiles.js'
import { assertSafeLabImportPath, resolvePathWithin } from './security/safeFiles.js'
import { logger } from './utils/logger.js'
import { getAllSettings } from './settingsManager.js'
import { getLabsPath } from './utils/paths.js'

const MANIFEST = 'manifest.json'

function draftsRoot() {
  ensureDataDirectories()
  return getDataLayout().labBuilderDrafts
}

function draftPath(draftId) {
  const safeId = /^[a-f0-9-]{8,}$/i.test(draftId) ? draftId : ''
  if (!safeId) {
    throw new Error('Invalid draft id')
  }
  return path.join(draftsRoot(), safeId)
}

function readUtf8(fp, fallback = '') {
  try {
    if (!fs.existsSync(fp)) return fallback
    return fs.readFileSync(fp, 'utf8')
  } catch {
    return fallback
  }
}

function parseJsonSafe(raw, fb) {
  try {
    return JSON.parse(raw)
  } catch {
    return fb
  }
}

/**
 * Runnable template lab (e.g. after applying a Docker preset). Kept for tooling/tests.
 * @param {string} [labId]
 */
export function defaultLabJson(labId = 'draft-lab-001') {
  return {
    id: labId,
    title: 'Untitled Draft Lab',
    difficulty: 'Easy',
    category: 'Custom',
    description: 'Describe your lab scenario. Credentials are generated per session when learners start the lab.',
    estimatedTimeMinutes: 45,
    runtime: 'docker',
    docker: {
      image: `sysadmin-game/${labId}:latest`,
      buildPath: '.',
      ports: [{ container: 22, protocol: 'tcp', purpose: 'ssh' }]
    },
    credentials: {
      host: '127.0.0.1',
      generatedPerSession: true,
      passwordLength: 16
    },
    tasks: ['SSH into the lab target from the Lab Terminal', 'Fulfill lab objectives', 'Check / Validate from the panel'],
    hints: [],
    questions: [],
    objectives: [
      {
        id: 'done',
        label: 'Create /tmp/lab-complete when finished',
        autoCheck: 'fileExists',
        path: '/tmp/lab-complete'
      }
    ],
    validation: { type: 'fileExists', path: '/tmp/lab-complete' },
    xpReward: 100
  }
}

/**
 * Minimal new draft for Lab Builder — may be incomplete until the author adds Dockerfile / tasks.
 * Strict (catalog / Build/Test) validation can fail until the draft is finished.
 * @param {{ title?: string }} [opts]
 */
export function createNewDraftLabObject(opts = {}) {
  const title = typeof opts.title === 'string' && opts.title.trim() ? opts.title.trim() : 'New Docker Lab'
  return {
    id: 'new-docker-lab',
    title,
    description: 'Describe the lab objective.',
    category: 'Custom',
    difficulty: 'Easy',
    runtime: 'docker',
    xpReward: 100,
    estimatedTimeMinutes: 15,
    credentials: {
      mode: 'generated',
      passwordLength: 18,
      host: '127.0.0.1',
      generatedPerSession: true
    },
    docker: {
      image: '',
      buildPath: '.',
      imageSource: 'local-build',
      baseImageId: 'ubuntu-22.04',
      builderGenerated: true,
      services: ['ssh'],
      packages: [],
      startupCommands: [],
      ports: [
        {
          containerPort: 22,
          protocol: 'tcp',
          purpose: 'ssh',
          label: 'SSH',
          exposeToHost: true,
          showToUser: true
        }
      ]
    },
    files: [
      {
        path: '/home/{{USERNAME}}/welcome.txt',
        content: 'Welcome to your lab.\n',
        owner: '{{USERNAME}}',
        group: '{{USERNAME}}',
        mode: '0644',
        stage: 'runtime'
      }
    ],
    directories: [],
    objectives: [],
    objectivesPublic: [],
    setupSecrets: [],
    unlockRequirements: {
      minLevel: 1,
      requiredLabs: [],
      requiredAchievements: [],
      recommendedSkills: []
    },
    tasks: [],
    hints: [],
    questions: [],
    validation: {
      type: 'fileExists',
      path: '/tmp/lab-complete'
    },
    variation: {
      enabled: true,
      credentials: { randomizeUsername: true },
      flags: {
        formats: ['SGQ-{HEX4}-LINUX', 'TRAINING-SSH-{HEX4}', 'LABFLAG-{HEX4}']
      },
      flagFile: {
        basename: '.hidden_flag',
        locations: ['/home/${username}/', '/opt/training/', '/var/tmp/']
      },
      decoys: { pickMin: 2, pickMax: 4, pool: [] },
      commandGuide: { rotate: true }
    }
  }
}

function manifestDefault(draftId) {
  return {
    draftId,
    title: '',
    vmBuilderNotice: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unsafeOverrideAllowedSnapshot: false
  }
}

function readManifest(dir) {
  const mPath = path.join(dir, MANIFEST)
  const m = parseJsonSafe(readUtf8(mPath, '{}'), {})
  return { ...manifestDefault(path.basename(dir)), ...m }
}

function writeManifest(dir, partial) {
  const cur = readManifest(dir)
  const next = {
    ...cur,
    ...partial,
    draftId: path.basename(dir),
    updatedAt: new Date().toISOString()
  }
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(next, null, 2), 'utf8')
}

function dockerTemplateFromPreset(presetKey) {
  const t = DOCKER_TEMPLATES[presetKey]
  return t ?? DOCKER_TEMPLATES.blank
}

export function applyDockerTemplatePreset(presetKey) {
  const t = dockerTemplateFromPreset(presetKey)
  return {
    Dockerfile: t.dockerfile,
    'entrypoint.sh': t.entrypoint,
    'validate.sh': t.validateSh
  }
}

export function generateDraftReadme(lab) {
  const uname = lab.credentials?.username ?? '(generated per session)'
  const img = lab.docker?.image ?? 'your-image:latest'
  return `# ${lab.title ?? 'Draft lab'}

Training-only scaffold. Replace sections before submitting to catalog.

## Summary

${lab.description ?? ''}

## Credentials

- Username: ${uname}
- Password: generated per session (do not commit secrets)

## Build (manual)

\`\`\`bash
docker build -t ${img} .
\`\`\`
`
}

export function listDrafts() {
  const root = draftsRoot()
  if (!fs.existsSync(root)) return []
  const out = []
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue
    const dir = path.join(root, ent.name)
    if (!fs.existsSync(path.join(dir, 'lab.json'))) continue
    const lab = parseJsonSafe(readUtf8(path.join(dir, 'lab.json')), {})
    const man = readManifest(dir)
    out.push({
      id: ent.name,
      title: lab.title ?? man.title ?? ent.name,
      labId: lab.id,
      runtime: lab.runtime,
      updatedAt: man.updatedAt
    })
  }
  out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  return out
}

/**
 * @param {{ title?: string, preset?: string }} [opts]
 * `preset` is optional — when set, Dockerfile/scripts are scaffolded from a template after lab.json exists.
 */
export function createDraft(opts = {}) {
  const draftId = crypto.randomUUID()
  const draftsBase = draftsRoot()
  const dir = path.join(draftsBase, draftId)
  const labPath = path.join(dir, 'lab.json')

  try {
    fs.mkdirSync(draftsBase, { recursive: true })
    fs.mkdirSync(dir, { recursive: true })

    const lab = createNewDraftLabObject({ title: opts.title })
    fs.writeFileSync(labPath, JSON.stringify(lab, null, 2), 'utf8')

    writeManifest(dir, {
      title: lab.title,
      vmBuilderNotice: false,
      createdAt: new Date().toISOString()
    })

    fs.writeFileSync(
      path.join(dir, 'README.md'),
      `# ${lab.title}\n\nDraft — add a Dockerfile (or apply a template) before Docker Build/Test or export.\n`,
      'utf8'
    )

    if (opts.preset) {
      const presetFiles = applyDockerTemplatePreset(opts.preset)
      fs.writeFileSync(path.join(dir, 'Dockerfile'), presetFiles.Dockerfile, 'utf8')
      fs.writeFileSync(path.join(dir, 'entrypoint.sh'), presetFiles['entrypoint.sh'], 'utf8')
      fs.writeFileSync(path.join(dir, 'validate.sh'), presetFiles['validate.sh'], 'utf8')
    } else if (lab.docker?.builderGenerated === true) {
      syncGeneratedDraftArtifacts(lab, dir, path.join(getLabsPath(), 'common'))
      fs.writeFileSync(labPath, JSON.stringify(lab, null, 2), 'utf8')
    }

    logger.info('labBuilder', 'Draft created', { draftId, dir, labId: lab.id })
    return getDraft(draftId)
  } catch (error) {
    logger.error('labBuilder', 'createDraft failed', {
      draftId,
      dir,
      draftsBase,
      labPath,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    try {
      if (draftId && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore cleanup failure
    }
    throw error
  }
}

export function getDraft(draftId) {
  const dir = draftPath(draftId)
  if (!fs.existsSync(dir)) throw new Error('Draft not found')
  const manifest = readManifest(dir)
  const lab = parseJsonSafe(readUtf8(path.join(dir, 'lab.json')), null)
  if (!lab) throw new Error('lab.json missing or invalid')

  const wsDir = path.join(dir, 'workstation')
  const files = {
    labJsonRaw: JSON.stringify(lab, null, 2),
    dockerfile: readUtf8(path.join(dir, 'Dockerfile')),
    entrypointSh: readUtf8(path.join(dir, 'entrypoint.sh')),
    validateSh: readUtf8(path.join(dir, 'validate.sh')),
    readme: readUtf8(path.join(dir, 'README.md')),
    workstationDockerfile: readUtf8(path.join(wsDir, 'Dockerfile')),
    workstationEntrypointSh: readUtf8(path.join(wsDir, 'entrypoint.sh')),
    workstationEntrypointPs1: readUtf8(path.join(wsDir, 'entrypoint.ps1')),
    dockerComposeYaml: readUtf8(path.join(dir, 'docker-compose.yml'))
  }

  const schemaResult = validateLabPayload(lab, { skipFolderMatch: true, mode: 'draft' })
  const safetyResult = analyzeLabDraftSafety(lab, {
    dockerfile: files.dockerfile,
    entrypoint: files.entrypointSh,
    workstationDockerfile: files.workstationDockerfile,
    validateSh: files.validateSh,
    readme: files.readme
  })

  const strictValid = schemaResult.strictValid === true
  const strictErrors =
    schemaResult.strictErrors ?? (strictValid ? [] : schemaResult.errors ?? ['Schema validation failed'])
  const draftWarnings = schemaResult.warnings ?? []

  return {
    draftId,
    manifest,
    lab,
    files,
    /** Same as strict / export / Build/Test readiness */
    schemaValid: strictValid,
    schemaErrors: strictErrors,
    draftWarnings,
    safety: safetyResult
  }
}

/**
 * Persist draft files; payload.lab object or labJsonRaw string optional.
 */
export function saveDraft(draftId, payload = {}) {
  const dir = draftPath(draftId)
  if (!fs.existsSync(dir)) throw new Error('Draft not found')

  /** @type {object | null} */
  let labObj = null
  if (typeof payload.labJsonRaw === 'string') {
    labObj = parseJsonSafe(payload.labJsonRaw, null)
  } else if (payload.lab && typeof payload.lab === 'object') {
    labObj = payload.lab
  } else {
    labObj = parseJsonSafe(readUtf8(path.join(dir, 'lab.json')), null)
  }
  if (!labObj) throw new Error('Could not resolve lab payload')

  syncFilesystemFields(labObj)

  const draftCheck = validateLabPayload(labObj, { skipFolderMatch: true, mode: 'draft' })
  if (!draftCheck.valid) {
    const msg = draftCheck.errors.join('; ') || 'Draft failed safety checks'
    logger.warn('labBuilder', 'saveDraft blocked', { draftId, msg })
    throw new Error(msg)
  }

  if (payload.manifest && typeof payload.manifest === 'object') {
    writeManifest(dir, payload.manifest)
  }

  fs.writeFileSync(path.join(dir, 'lab.json'), JSON.stringify(labObj, null, 2), 'utf8')

  const repoCommon = path.join(getLabsPath(), 'common')
  if (labObj.docker?.builderGenerated === true || labObj.docker?.imageSource === 'local-build') {
    try {
      syncGeneratedDraftArtifacts(labObj, dir, repoCommon)
      fs.writeFileSync(path.join(dir, 'lab.json'), JSON.stringify(labObj, null, 2), 'utf8')
    } catch (error) {
      logger.warn('labBuilder', 'Target artifact generation failed', {
        draftId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  if (isCustomWorkstationEnabled(labObj)) {
    try {
      syncGeneratedWorkstationArtifacts(labObj, dir, repoCommon)
      fs.writeFileSync(path.join(dir, 'lab.json'), JSON.stringify(labObj, null, 2), 'utf8')
    } catch (error) {
      logger.warn('labBuilder', 'Workstation artifact generation failed', {
        draftId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  if (typeof payload.dockerfile === 'string') {
    fs.writeFileSync(path.join(dir, 'Dockerfile'), payload.dockerfile, 'utf8')
  }
  if (typeof payload.entrypointSh === 'string') {
    fs.writeFileSync(path.join(dir, 'entrypoint.sh'), payload.entrypointSh, 'utf8')
  }
  if (typeof payload.validateSh === 'string') {
    fs.writeFileSync(path.join(dir, 'validate.sh'), payload.validateSh, 'utf8')
  }
  if (typeof payload.readme === 'string') {
    fs.writeFileSync(path.join(dir, 'README.md'), payload.readme, 'utf8')
  }
  if (typeof payload.dockerComposeYaml === 'string' && payload.dockerComposeYaml.trim()) {
    fs.writeFileSync(path.join(dir, 'docker-compose.yml'), payload.dockerComposeYaml, 'utf8')
  }

  writeManifest(dir, { title: labObj.title })
  logger.info('labBuilder', 'Draft saved', { draftId })
  return getDraft(draftId)
}

export function deleteDraft(draftId) {
  const dir = draftPath(draftId)
  fs.rmSync(dir, { recursive: true, force: true })
  return { draftId, deleted: true }
}

export function duplicateDraft(sourceDraftId, newLabIdSuggestion) {
  const srcDir = draftPath(sourceDraftId)
  if (!fs.existsSync(srcDir)) throw new Error('Source draft missing')
  const nextId = crypto.randomUUID()
  const destDir = path.join(draftsRoot(), nextId)
  fs.cpSync(srcDir, destDir, { recursive: true })

  const labRaw = parseJsonSafe(readUtf8(path.join(destDir, 'lab.json')), null)
  /** @type {object | null} */
  let lab = labRaw
  if (
    lab &&
    newLabIdSuggestion &&
    /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(String(newLabIdSuggestion))
  ) {
    lab.id = String(newLabIdSuggestion)
    if (lab.docker) {
      lab.docker.image =
        typeof lab.docker.image === 'string' && lab.docker.image.trim()
          ? lab.docker.image
          : `sysadmin-game/${lab.id}:latest`
    }
    fs.writeFileSync(path.join(destDir, 'lab.json'), JSON.stringify(lab, null, 2), 'utf8')
  }

  fs.rmSync(path.join(destDir, MANIFEST), { force: true })
  writeManifest(destDir, { title: lab?.title, createdFrom: sourceDraftId })
  return getDraft(nextId)
}

function collectDirFiles(src) {
  const allow = [
    'lab.json',
    'Dockerfile',
    'docker-compose.yml',
    'entrypoint.sh',
    'validate.sh',
    'README.md',
    'lab-files-manifest.json'
  ]
  /** @type {string[]} */
  const files = []
  for (const name of allow) {
    const fp = path.join(src, name)
    if (fs.existsSync(fp)) files.push(fp)
  }
  const filesDir = path.join(src, 'files')
  if (fs.existsSync(filesDir)) {
    const walk = (dir, prefix = '') => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${ent.name}` : ent.name
        const full = path.join(dir, ent.name)
        if (ent.isDirectory()) walk(full, rel)
        else files.push(full)
      }
    }
    walk(filesDir)
  }
  const commonDir = path.join(src, 'common')
  if (fs.existsSync(commonDir)) {
    for (const ent of fs.readdirSync(commonDir)) {
      const fp = path.join(commonDir, ent)
      if (fs.statSync(fp).isFile()) files.push(fp)
    }
  }
  return files
}

/**
 * @param {object} lab
 * @param {{ redactSecrets?: boolean, dockerfile?: string, entrypoint?: string, validateSh?: string, readme?: string }} [fileTexts]
 */
export function previewDraftLab(lab, fileTexts = {}) {
  return buildLabBuilderPreview(lab, fileTexts)
}

/**
 * @param {string} draftId
 */
export function previewDraftById(draftId) {
  const d = getDraft(draftId)
  const settings = getAllSettings()
  return buildLabBuilderPreview(d.lab, {
    redactSecrets: settings.developerMode !== true,
    dockerfile: d.files.dockerfile,
    entrypoint: d.files.entrypointSh,
    workstationDockerfile: d.files.workstationDockerfile,
    workstationEntrypoint: d.files.workstationEntrypointSh || d.files.workstationEntrypointPs1,
    validateSh: d.files.validateSh,
    readme: d.files.readme
  })
}

/**
 * @param {string} draftId
 */
export function applyMockWebsiteToDraft(draftId) {
  const dir = draftPath(draftId)
  const lab = parseJsonSafe(readUtf8(path.join(dir, 'lab.json')), null)
  if (!lab) throw new Error('lab.json missing')
  const next = applyMockWebsiteTemplate(lab)
  return saveDraft(draftId, { labJsonRaw: JSON.stringify(next, null, 2) })
}

/**
 * @param {'folder'|'zip'} format
 */
export function exportDraftToDisk(draftId, targetAbsolute, format = 'folder') {
  const src = draftPath(draftId)
  if (!fs.existsSync(src)) throw new Error('Draft not found')

  const fresh = getDraft(draftId)
  const strict = validateLabPayload(fresh.lab, { skipFolderMatch: true, mode: 'strict' })
  if (!strict.valid) {
    throw new Error(
      `Export requires strict schema-valid lab.json: ${strict.errors.join('; ') || 'validation failed'}`
    )
  }

  const blocked = fresh.safety.hasBlocked
  const allowUnsafe = Boolean(getAllSettings().labBuilderUnsafeOverride) && blocked
  if (blocked && !allowUnsafe) {
    throw new Error(
      'Export blocked by safety analyzer. Fix issues or enable dev unsafe override in Settings.'
    )
  }

  const labFolderName = typeof fresh.lab?.id === 'string' ? fresh.lab.id : draftId

  if (format === 'folder') {
    const dest = path.join(targetAbsolute, labFolderName)
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true })
    }
    fs.cpSync(src, dest, { recursive: true })
    fs.rmSync(path.join(dest, 'manifest.json'), { force: true })
    return { path: dest, format: 'folder' }
  }

  const zip = new AdmZip()
  const files = collectDirFiles(src)
  for (const fp of files) {
    const rel = path.relative(src, fp).split(path.sep).join('/')
    const dirInZip = path.dirname(rel)
    zip.addLocalFile(fp, dirInZip === '.' ? '' : dirInZip, path.basename(fp))
  }
  zip.writeZip(targetAbsolute)
  return { path: targetAbsolute, format: 'zip' }
}

/**
 * Export draft to an in-memory zip buffer (for registry publish).
 * @param {string} draftId
 */
export function exportDraftToZipBuffer(draftId) {
  const src = draftPath(draftId)
  if (!fs.existsSync(src)) throw new Error('Draft not found')

  const fresh = getDraft(draftId)
  const strict = validateLabPayload(fresh.lab, { skipFolderMatch: true, mode: 'strict' })
  if (!strict.valid) {
    throw new Error(
      `Publish requires strict schema-valid lab.json: ${strict.errors.join('; ') || 'validation failed'}`
    )
  }

  const blocked = fresh.safety.hasBlocked
  const allowUnsafe = Boolean(getAllSettings().labBuilderUnsafeOverride) && blocked
  if (blocked && !allowUnsafe) {
    throw new Error(
      'Publish blocked by safety analyzer. Fix issues or enable dev unsafe override in Settings.'
    )
  }

  const zip = new AdmZip()
  const files = collectDirFiles(src)
  for (const fp of files) {
    const rel = path.relative(src, fp).split(path.sep).join('/')
    const dirInZip = path.dirname(rel)
    zip.addLocalFile(fp, dirInZip === '.' ? '' : dirInZip, path.basename(fp))
  }
  return zip.toBuffer()
}

/**
 * Publish draft lab pack to the online registry (requires linked account).
 * @param {string} draftId
 * @param {string} [changelog]
 */
export async function publishDraftToRegistry(draftId, changelog = '') {
  const buffer = exportDraftToZipBuffer(draftId)
  const { publishLabPackToRegistry } = await import('./online/onlineLabPublish.js')
  return publishLabPackToRegistry(buffer, changelog)
}

/**
 * @param {string} draftId
 * @param {{
 *   filePaths: string[]
 *   destPath: string
 *   scope?: string
 *   stage?: string
 *   renderVariables?: boolean
 * }} options
 */
export function importAssetsToDraft(draftId, options) {
  const dir = draftPath(draftId)
  if (!fs.existsSync(dir)) throw new Error('Draft not found')
  const filePaths = options.filePaths ?? []
  if (!filePaths.length) throw new Error('No files selected')

  let lab = parseJsonSafe(readUtf8(path.join(dir, 'lab.json')), null)
  if (!lab) throw new Error('lab.json missing')

  const destBase = String(options.destPath ?? '/tmp/import').trim()
  const imports = filePaths.map((sourcePath) => {
    const base = path.basename(sourcePath)
    let destPath = destBase
    if (destPath.includes('{{')) {
      // template path as-is
    } else if (destPath.endsWith('/')) {
      destPath = `${destPath}${base}`
    } else if (!destPath.includes('.')) {
      destPath = `${destPath}/${base}`
    }
    return {
      sourcePath,
      destPath,
      scope: options.scope === 'workstation' ? 'workstation' : 'target',
      stage: options.stage,
      renderVariables: options.renderVariables
    }
  })

  lab = applyImportsToDraft(dir, lab, imports)
  fs.writeFileSync(path.join(dir, 'lab.json'), JSON.stringify(lab, null, 2), 'utf8')
  logger.info('labBuilder', 'Assets imported', { draftId, count: filePaths.length })
  const draft = getDraft(draftId)
  return {
    ...draft,
    message: `Imported ${filePaths.length} item(s) to ${destBase}`
  }
}

export function importDraftFromFolder(importedAbsolutePath) {
  const newId = crypto.randomUUID()
  const dir = resolvePathWithin(draftsRoot(), newId)
  assertSafeLabImportPath(importedAbsolutePath, dir)
  fs.cpSync(path.resolve(importedAbsolutePath), dir, { recursive: true })
  if (!fs.existsSync(path.join(dir, 'lab.json'))) {
    fs.rmSync(dir, { recursive: true, force: true })
    throw new Error('Imported folder must contain lab.json')
  }
  writeManifest(dir, { importedFrom: path.resolve(importedAbsolutePath) })
  logger.info('labBuilder', 'Draft imported', { newId })
  return getDraft(newId)
}

export async function buildTestDraft(draftId) {
  const d = getDraft(draftId)
  if (!d.lab || d.lab.runtime !== 'docker') {
    throw new Error('Builder test supports Docker drafts only.')
  }

  const schema = validateLabPayload(d.lab, { skipFolderMatch: true, mode: 'strict' })
  if (!schema.valid) throw new Error(schema.errors[0] ?? 'lab.json schema invalid.')

  const safe = analyzeLabDraftSafety(d.lab, {
    dockerfile: d.files.dockerfile,
    entrypoint: d.files.entrypointSh,
    validateSh: d.files.validateSh,
    readme: d.files.readme
  })
  const allowUnsafe = Boolean(getAllSettings().labBuilderUnsafeOverride) && safe.hasBlocked
  if (safe.hasBlocked && !allowUnsafe) {
    throw new Error(
      'Build/Test blocked due to safety issues. Resolve blocked items or enable dev unsafe override.'
    )
  }

  const draftRootPath = draftPath(draftId)
  return startDraftLabSession({ draftRootPath })
}

/**
 * Stop a builder test Docker session without affecting catalog lab progress.
 * @param {string} sessionId
 */
export async function stopDraftTest(sessionId) {
  const session = getSessionState(sessionId)
  if (!session.builderTest) {
    throw new Error('Not a Lab Builder test session.')
  }
  return stopLab(sessionId)
}

export function applyTemplateToDraft(draftId, presetKey) {
  const presetFiles = applyDockerTemplatePreset(presetKey ?? 'ubuntu-ssh')
  return saveDraft(draftId, {
    dockerfile: presetFiles.Dockerfile,
    entrypointSh: presetFiles['entrypoint.sh'],
    validateSh: presetFiles['validate.sh']
  })
}

export function regenerateReadmeForDraft(draftId) {
  const dir = draftPath(draftId)
  const lab = parseJsonSafe(readUtf8(path.join(dir, 'lab.json')), {})
  const readme = generateDraftReadme(lab)
  fs.writeFileSync(path.join(dir, 'README.md'), readme, 'utf8')
  writeManifest(dir, {})
  return readme
}

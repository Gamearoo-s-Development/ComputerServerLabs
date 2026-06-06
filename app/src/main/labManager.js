/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Ajv from 'ajv'
import fs from 'fs'
import path from 'path'
import * as dockerManager from './dockerManager.js'
import { buildSgqLabels, LIFECYCLE_EPHEMERAL, LIFECYCLE_PERSISTENT, ROLE_TARGET } from './labResourceLabels.js'
import { cleanupSessionResources, collectSessionResources } from './sessionCleanup.js'
import {
  clearDesktopRecoverySnapshot,
  listDesktopRecoverySessionIds,
  loadDesktopRecoverySnapshot,
  scanRecoverableDesktopSetups
} from './desktopSetupRecovery.js'
import { restoreSessionVariation } from './sessionVariationManager.js'
import { loadMissionSessionCredentials } from './missionSessionCredentials.js'
import { waitForDesktopWorkstationReady } from './workstation/workstationReadiness.js'
import { isDesktopReadinessComplete } from '@sysadmin-game/shared/workstations/desktopReadinessLogic.js'
import { countObjectiveHintsAvailable } from '@sysadmin-game/shared/lab-format/labObjectiveHints.js'
import { sortLabsByUnlockOrder } from '@sysadmin-game/shared/lab-format/labUnlockSort.js'
import {
  createMissionSessionCredentials
} from './missionSessionCredentials.js'
import { initSessionObjectives, clearSessionObjectives } from './autoProgressManager.js'
import { detachTerminalsForSession } from './terminalManager.js'
import { closeLabTerminalWindow } from './terminalWindowManager.js'
import { provisionDockerLabEnvironment, buildSessionHelperState } from './sandboxLabProvisioner.js'
import { sanitizeWorkstationCredentialsForClient } from './workstationCredentials.js'
import { inspectWorkstationAccessRoutes } from './workstation/workstationAccessRoutes.js'
import {
  isDesktopWorkstationHelper,
  isWindowsDesktopWorkstationHelper
} from './workstation/workstationDesktopSession.js'
import { getWorkstationDesktopConfig } from './workstation/workstationDesktopConfig.js'
import { buildLabConnectionRoutes } from './labConnectionRoutes.js'
import { createSessionLabNetwork, buildSessionNetworkName } from './sessionNetwork.js'
import {
  resolveSessionDockerRuntime,
  toDockerManagerRuntime,
  isSessionWslDockerRuntime
} from './sessionDockerRuntime.js'
import { DOCKER_RUNTIME_WSL_KVM } from './wsl/wslDockerKvm.js'
import { resolveWorkstationChoice } from './workstationProfiles.js'
import { WorkstationStartError } from './workstation/workstationStartError.js'
import { cancelMissionStartup } from './missionStartupProgress.js'
import {
  buildInternalLabConnection,
  getInternalLabSshRoute,
  INTERNAL_SSH_CONTAINER_PORT,
  normalizeLabPortDefinitions,
  applySessionPortPolicy,
  SANDBOX_SSH_TARGET
} from './labPorts.js'
import {
  enrichLabCatalogWithIncident,
  getIncidentBriefingForLab,
  labHasIncidentBriefing,
  readLabAttachment
} from './labIncident.js'
import { initSessionTelemetry, clearSessionTelemetry } from './labSessionTelemetry.js'
import {
  buildServiceRoutes,
  enrichPortMappings,
  probeAllServiceRoutes
} from './labServiceRoutes.js'
import {
  isSecuritySimulationLab,
  getTargetServiceDefinitions,
  mergeTargetEnumerationServiceRoutes,
  resolveLabAccessMode,
  sanitizeSessionForClient
} from './securitySimulationLab.js'
import { getWorkstationProfile } from './workstation/workstationCatalog.js'
import { LAB_IMAGE_ENTRYPOINT_VERSION } from './labImageVersion.js'
import {
  clearSessionVariation,
  createSessionVariation,
  getSessionVariationSecret,
  getSessionVariationSummary,
  registerSessionHostPorts
} from './sessionVariationManager.js'
import {
  assertLabUnlocked,
  clearLabUnlockCatalogCache,
  enrichLabCatalogEntry,
  evaluateLabUnlock,
  buildProgressContext
} from './labUnlockManager.js'
import { deleteIncompleteLabSession } from './progressManager.js'
import {
  LAB_MODE_TARGET_ONLY,
  LAB_MODE_TARGET_PLUS_WORKSTATION,
  resolveLabMode
} from './lab/labMode.js'
import { getAllSettings } from './settingsManager.js'
import { scanDirectoryForUnsafeContent } from './security/safeFiles.js'
import { logger } from './utils/logger.js'
import { getOnlineStatus } from './online/onlineApiClient.js'
import { notifyLabDeploymentReady } from './online/onlineNotificationManager.js'

function maybeNotifyLabDeploymentReady(labId, lab, sessionId) {
  if (!getOnlineStatus().linked) return
  void notifyLabDeploymentReady({
    labId,
    labTitle: lab?.title ?? lab?.name ?? labId
  }).catch((error) => {
    logger.warn('labManager', 'Lab deployment ready email failed', {
      labId,
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    })
  })
}
import { getConfigPath, getLabsPath, getOnlineLabsRoot, getUserDataRoot } from './utils/paths.js'
import {
  clearLabLocationCache,
  discoverLabLocations,
  resolveLabCatalogLocation
} from './labCatalogDiscovery.js'
import {
  assertFolderMatchesId,
  assertLabSafety,
  assertSafeLabId,
  assertSafeSessionId,
  buildContainerName,
  createSessionId,
  getSafetyModeConfig
} from './utils/sanitize.js'

/** @type {import('ajv').default | null} */
let ajvInstance = null

/** @type {import('ajv').ValidateFunction | null} */
let validateLabSchema = null

/** @type {Map<string, object>} */
const labCache = new Map()

/** @type {Map<string, LabSession>} */
const sessions = new Map()

/**
 * @param {{ container?: number, containerPort?: number, host?: number, hostPort?: number, hostIp?: string, protocol?: string, purpose?: string, published?: string }[]} ports
 */
function normalizeSessionPorts(ports = []) {
  return (Array.isArray(ports) ? ports : []).map((port) => {
    const containerPort = Number(port?.containerPort ?? port?.container ?? 0) || 0
    const hostPort = Number(port?.hostPort ?? port?.host ?? 0) || 0
    const hostIp = port?.hostIp || '127.0.0.1'
    return {
      ...port,
      container: containerPort,
      containerPort,
      host: hostPort,
      hostPort,
      hostIp,
      protocol: port?.protocol ?? 'tcp',
      purpose: port?.purpose ?? (containerPort === 22 ? 'ssh' : 'service')
    }
  })
}

/**
 * Resolve workstation + Docker runtime and create the per-session bridge network.
 * @param {object} lab
 * @param {string} sessionId
 * @param {string} labId
 * @param {object} track
 * @param {{ workstationPreference?: string, workstationProfileId?: string }} [options]
 */
async function prepareSessionNetworkAndRuntime(lab, sessionId, labId, track, options = {}) {
  const settings = getAllSettings()
  const workstationResolution = await resolveWorkstationChoice(settings, lab, undefined, {
    sessionPreference: options.workstationPreference,
    forcedProfileId: options.workstationProfileId
  })
  const runtimeResolution = await resolveSessionDockerRuntime(workstationResolution.profile)
  if (!runtimeResolution.ok) {
    throw new WorkstationStartError(runtimeResolution.reason ?? 'Desktop runtime unavailable.', {
      stage: 'docker_runtime_unavailable',
      report: runtimeResolution.wslSnapshot?.report ?? ''
    })
  }
  track.sessionDockerRuntime = runtimeResolution.dockerRuntime
  const { networkName, subnet: networkSubnet } = await createSessionLabNetwork({
    sessionId,
    labId,
    dockerRuntime: runtimeResolution.dockerRuntime
  })
  track.networkName = networkName
  track.networkSubnet = networkSubnet
  return { networkName, networkSubnet, sessionDockerRuntime: runtimeResolution.dockerRuntime }
}

/**
 * @param {object} lab
 * @param {object} targetResult
 */
async function buildSessionPortBundle(lab, targetResult, options = {}) {
  const portSpecs = applySessionPortPolicy(normalizeLabPortDefinitions(lab.docker?.ports), options)
  const normalizedPorts = enrichPortMappings(
    portSpecs,
    normalizeSessionPorts(targetResult.ports ?? [])
  )
  let serviceRoutes = buildServiceRoutes(portSpecs, normalizedPorts)
  serviceRoutes = mergeTargetEnumerationServiceRoutes(lab, portSpecs, normalizedPorts, serviceRoutes)
  serviceRoutes = await probeAllServiceRoutes(serviceRoutes)
  return { portSpecs, ports: normalizedPorts, serviceRoutes }
}

/**
 * @param {{ username?: string, password?: string, targetInternalIp?: string, host?: string, sshPort?: number | null }} credentials
 * @param {{ host?: string, port?: number } | null} internalRoute
 */
function buildSessionConnection(credentials, internalRoute) {
  const host = internalRoute?.host ?? credentials?.targetInternalIp ?? credentials?.host
  if (!host || host === '127.0.0.1' || host === 'localhost' || host === 'host.docker.internal') {
    return null
  }
  const port =
    Number(internalRoute?.port ?? credentials?.sshPort ?? INTERNAL_SSH_CONTAINER_PORT) ||
    INTERNAL_SSH_CONTAINER_PORT
  return buildInternalLabConnection(credentials?.username ?? '', credentials?.password ?? '', host, port)
}

/**
 * @param {string} sessionId
 * @param {'trainingFlag' | 'flagFilename' | 'flagPath' | string} key
 */
export function getSessionSecret(sessionId, key) {
  return getSessionVariationSecret(sessionId, key)
}

/**
 * @typedef {object} LabSession
 * @property {string} sessionId
 * @property {string} labId
 * @property {string} containerName
 * @property {string} containerId
 * @property {'running' | 'stopped' | 'destroyed'} status
 * @property {{ container: number, host: number, hostIp?: string, protocol?: string, purpose?: string, published?: string }[]} ports
 * @property {{ host: string, port: number | null, protocol: 'ssh', username: string, password: string }} [connection]
 * @property {object} credentials
 * @property {object[]} [objectives]
 * @property {string} image
 * @property {string} startedAt
 * @property {string} [stoppedAt]
 * @property {boolean} [builderTest]
 * @property {string} [draftRootPath]
 * @property {object} [embeddedLab]
 * @property {object} [variationSummary]
 */

function loadSchemaValidator() {
  if (validateLabSchema) return validateLabSchema

  const schemaPath = getConfigPath('lab.schema.json')
  if (!fs.existsSync(schemaPath)) {
    logger.error('labManager', 'Lab schema file not found', { schemaPath })
    return null
  }

  try {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
    ajvInstance = new Ajv({ allErrors: true, strict: false })
    validateLabSchema = ajvInstance.compile(schema)
    return validateLabSchema
  } catch (error) {
    logger.error('labManager', 'Failed to load lab schema', {
      schemaPath,
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

/**
 * @param {string} labsRoot
 * @param {string} folderName
 */
function readLabFile(labsRoot, folderName) {
  const labPath = path.join(labsRoot, folderName, 'lab.json')
  const raw = fs.readFileSync(labPath, 'utf8')
  const data = JSON.parse(raw)
  return { data, labPath, folderName }
}

/**
 * Validate lab JSON (optional folder consistency check vs labs/<folder>/ naming).
 * @param {object} lab
 * @param {{ skipFolderMatch?: boolean, folderName?: string, mode?: 'strict' | 'draft' }} [options]
 * @returns {{ valid: boolean, errors: string[], warnings?: string[], strictValid?: boolean, strictErrors?: string[] }}
 */
export function validateLabPayload(lab, options = {}) {
  /** @type {'strict' | 'draft'} */
  const mode = options.mode ?? 'strict'

  if (lab?.credentials?.password) {
    const msg =
      'Hardcoded credentials.password is not allowed — passwords are generated per session'
    if (mode === 'draft') {
      return {
        valid: false,
        errors: [msg],
        warnings: [],
        strictValid: false,
        strictErrors: [msg]
      }
    }
    return { valid: false, errors: [msg] }
  }

  if (mode === 'draft') {
    /** @type {string[]} */
    const warnings = []

    if (!lab || typeof lab !== 'object' || Array.isArray(lab)) {
      const msg = 'Lab definition must be a JSON object'
      return {
        valid: false,
        errors: [msg],
        warnings: [],
        strictValid: false,
        strictErrors: [msg]
      }
    }

    try {
      assertLabSafety(lab)
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error))
    }

    const validate = loadSchemaValidator()
    if (!validate) {
      const schemaMsg = `Lab schema unavailable at ${getConfigPath('lab.schema.json')}`
      warnings.push(schemaMsg)
      return {
        valid: true,
        errors: [],
        warnings,
        strictValid: false,
        strictErrors: [schemaMsg]
      }
    }

    const strictValid = validate(lab)
    const strictErrors = strictValid
      ? []
      : [ajvInstance?.errorsText(validate.errors, { separator: '; ' }) ?? 'Schema validation failed']

    if (!strictValid) {
      warnings.push('Strict (export / Build / catalog): fix schema issues below before shipping or running a test container.')
    }

    return {
      valid: true,
      errors: [],
      warnings,
      strictValid,
      strictErrors
    }
  }

  const validate = loadSchemaValidator()
  if (!validate) {
    return {
      valid: false,
      errors: [`Lab schema unavailable at ${getConfigPath('lab.schema.json')}`]
    }
  }

  const valid = validate(lab)
  if (!valid) {
    const message =
      ajvInstance?.errorsText(validate.errors, { separator: '; ' }) ?? 'Schema validation failed'
    return { valid: false, errors: [message] }
  }

  try {
    assertLabSafety(lab)
    if (!options.skipFolderMatch && options.folderName) {
      assertFolderMatchesId(options.folderName, lab.id)
    }
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)]
    }
  }

  if (lab.runtime !== 'docker') {
    const rt = lab.runtime === 'virtualbox' ? 'vm' : lab.runtime
    return {
      valid: false,
      errors: [`Runtime "${rt}" is not supported. Use runtime "docker" with a docker block.`]
    }
  }

  if (!lab.docker) {
    return { valid: false, errors: ['Docker runtime requires a docker block'] }
  }

  return { valid: true, errors: [] }
}

function validateLabDocument(lab, folderName, labsRoot = getLabsPath()) {
  const isOnlineInstall =
    fs.existsSync(getOnlineLabsRoot()) &&
    path.resolve(labsRoot) === path.resolve(getOnlineLabsRoot())
  return validateLabPayload(lab, {
    folderName,
    mode: isOnlineInstall ? 'draft' : 'strict'
  })
}

/**
 * @param {object} lab
 */
export function payloadToExerciseLab(lab) {
  assertSafeLabId(lab.id)
  const docker = lab.docker ?? null
  const labMode = resolveLabMode(lab)
  const runnableDocker = Boolean(docker && lab.runtime === 'docker')
  return {
    ...{
      id: lab.id,
      title: lab.title,
      difficulty: lab.difficulty,
      category: lab.category,
      description: lab.description,
      hideDirectSshCommand: lab.hideDirectSshCommand === true,
      securitySimulation: isSecuritySimulationLab(lab),
      securitySubcategory: lab.securitySubcategory ?? null,
      accessMode: resolveLabAccessMode(lab),
      targetServices: getTargetServiceDefinitions(lab),
      runtime: lab.runtime,
      labMode,
      xpReward: lab.xpReward
    },
    valid: true,
    runnable: runnableDocker,
    available: runnableDocker,
    tasks: lab.tasks,
    hints: lab.hints ?? [],
    questions: lab.questions ?? [],
    objectives: lab.objectives ?? [],
    objectivesPublic: lab.objectivesPublic ?? [],
    setupSecrets: lab.setupSecrets ?? [],
    flags: (lab.flags ?? []).map((f) => ({
      id: f.id,
      path: f.path ?? null,
      showToUser: f.showToUser === true
    })),
    credentials: lab.credentials
      ? {
          username: lab.credentials.username ?? null,
          host: lab.credentials.host ?? '127.0.0.1',
          generatedPerSession: lab.credentials.generatedPerSession !== false
        }
      : { username: null, host: '127.0.0.1', generatedPerSession: true },
    docker,
    validation: lab.validation,
    commandGuide: lab.commandGuide ?? null,
    redHerrings: lab.redHerrings ?? [],
    warnings: [],
    hasDockerfile: true,
    hasReadme: true,
    safetyMode: getSafetyModeConfig()
  }
}

/**
 * @param {LabSession | object} session
 */
export function resolveLabFromSession(session) {
  if (session.builderTest && session.embeddedLab && typeof session.embeddedLab === 'object') {
    return payloadToExerciseLab(session.embeddedLab)
  }
  return getLab(session.labId)
}

/**
 * @param {string} labsRoot
 * @param {string} folderName
 */
function loadLabDefinition(labsRoot, folderName) {
  const cacheKey = path.join(labsRoot, folderName)
  if (labCache.has(cacheKey)) {
    return labCache.get(cacheKey)
  }

  let result
  try {
    const { data, labPath } = readLabFile(labsRoot, folderName)
    const isOnlineInstall =
      fs.existsSync(getOnlineLabsRoot()) &&
      path.resolve(labsRoot) === path.resolve(getOnlineLabsRoot())
    const validation = validateLabPayload(data, {
      folderName,
      mode: isOnlineInstall ? 'draft' : 'strict'
    })
    const dockerfilePath = path.join(labsRoot, folderName, 'Dockerfile')
    const hasDockerfile = fs.existsSync(dockerfilePath)
    const readmePath = path.join(labsRoot, folderName, 'README.md')
    const hasReadme = fs.existsSync(readmePath)
    const labDir = path.join(labsRoot, folderName)
    const contentIssues = scanDirectoryForUnsafeContent(labDir)

    let runnable = validation.valid && data.runtime === 'docker' && Boolean(data.docker)
    const warnings = []

    if (data.runtime !== 'docker') {
      runnable = false
      warnings.push(`Runtime "${data.runtime}" is not supported — use runtime "docker"`)
    }

    if (validation.valid && data.runtime === 'docker' && data.docker?.buildPath && !hasDockerfile) {
      runnable = false
      warnings.push('Dockerfile missing for local build')
    }

    if (contentIssues.length > 0) {
      runnable = false
      validation.valid = false
      validation.errors = [...(validation.errors ?? []), ...contentIssues.slice(0, 3)]
      warnings.push('Lab folder contains disallowed file types (see errors)')
    }

    result = {
      id: data.id ?? folderName,
      folder: folderName,
      labPath,
      lab: validation.valid ? data : null,
      valid: validation.valid,
      runnable,
      errors: validation.errors,
      warnings,
      hasDockerfile,
      hasReadme,
      metadata: validation.valid
        ? enrichLabCatalogWithIncident(data, {
            id: data.id,
            title: data.title,
            difficulty: data.difficulty,
            category: data.category,
            description: data.description,
            runtime: data.runtime,
            labMode: resolveLabMode(data),
            xpReward: data.xpReward,
            taskCount: data.tasks?.length ?? 0,
            hintCount: countObjectiveHintsAvailable(data),
            bundled: data.bundled === true,
            tags: Array.isArray(data.tags) ? data.tags : [],
            estimatedTimeMinutes: data.estimatedTimeMinutes ?? null
          })
        : {
            id: folderName,
            title: folderName,
            difficulty: 'Unknown',
            category: 'Invalid',
            description: validation.errors[0] ?? 'Invalid lab definition',
            runtime: 'unknown',
            xpReward: 0,
            taskCount: 0,
            hintCount: 0
          }
    }
  } catch (error) {
    result = {
      id: folderName,
      folder: folderName,
      labPath: path.join(labsRoot, folderName, 'lab.json'),
      lab: null,
      valid: false,
      runnable: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      hasDockerfile: false,
      hasReadme: false,
      metadata: {
        id: folderName,
        title: folderName,
        difficulty: 'Unknown',
        category: 'Invalid',
        description: error instanceof Error ? error.message : 'Failed to read lab.json',
        runtime: 'unknown',
        xpReward: 0,
        taskCount: 0,
        hintCount: 0
      }
    }
  }

  labCache.set(cacheKey, result)
  return result
}

function listLabFolders(labsRoot) {
  if (!fs.existsSync(labsRoot)) {
    return []
  }
  return fs
    .readdirSync(labsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => fs.existsSync(path.join(labsRoot, name, 'lab.json')))
}

export function clearLabCache() {
  labCache.clear()
  clearLabLocationCache()
  clearLabUnlockCatalogCache()
}

/**
 * Lab timer and objectives begin when the learner clicks Start lab (activateLabSession).
 * @param {boolean} isDesktopWorkstation
 * @param {object | null | undefined} workstationReadiness
 */
function buildDesktopLabSessionTiming(isDesktopWorkstation, workstationReadiness) {
  const environmentReady =
    !isDesktopWorkstation || isDesktopReadinessComplete(workstationReadiness?.state) === true
  return {
    status: environmentReady ? 'running' : 'preparing',
    activated: false,
    startedAt: null,
    awaitingDesktopEnter: true
  }
}

/**
 * Lab ids with a running in-memory session (learner or builder test).
 * @returns {string[]}
 */
export function getActiveLabIds() {
  return [...sessions.values()]
    .filter((session) => session.status === 'running')
    .map((session) => session.labId)
}

/**
 * @returns {string[]}
 */
export function getActiveSessionIds() {
  return [...sessions.keys()]
}

/**
 * Sanitized running sessions for renderer restore after navigation.
 * @returns {object[]}
 */
export function listActiveSessions() {
  /** @type {object[]} */
  const active = []
  for (const session of sessions.values()) {
    if (session.status !== 'running') continue
    try {
      const lab = resolveLabFromSession(session)
      active.push(sanitizeSessionForClient(session, lab))
    } catch (error) {
      logger.warn('labManager', 'Skipping session in listActiveSessions', {
        sessionId: session.sessionId,
        labId: session.labId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  active.sort((a, b) => Date.parse(b.startedAt ?? 0) - Date.parse(a.startedAt ?? 0))
  return active
}

/**
 * @returns {{ labs: object[], count: number, validCount: number, runnableCount: number }}
 */
export function listLabs() {
  const locations = discoverLabLocations()
  const progressCtx = buildProgressContext({ activeLabIds: getActiveLabIds() })
  const labs = locations.map((loc) => {
    const entry = loadLabDefinition(loc.labsRoot, loc.folder)
    const lab = entry.lab
    const unlock = lab ? evaluateLabUnlock(lab, progressCtx) : null
    const unlockFields = unlock ? enrichLabCatalogEntry(lab, unlock) : {}
    const bundledFlag = lab?.bundled === true || loc.bundled === true
    return {
      ...entry.metadata,
      valid: entry.valid,
      runnable: entry.runnable,
      available: entry.runnable && (unlock?.unlocked ?? true),
      errors: entry.errors,
      warnings: entry.warnings,
      hasDockerfile: entry.hasDockerfile,
      hasReadme: entry.hasReadme,
      ports: lab?.docker?.ports ?? [],
      dockerImage: lab?.docker?.image ?? null,
      validationType: lab?.validation?.type ?? null,
      source: loc.source,
      bundled: bundledFlag,
      tags: lab?.tags ?? entry.metadata?.tags ?? [],
      relativePath: loc.relativePath,
      ...unlockFields
    }
  })

  const sortedLabs = sortLabsByUnlockOrder(labs)

  return {
    labs: sortedLabs,
    count: sortedLabs.length,
    validCount: sortedLabs.filter((l) => l.valid).length,
    runnableCount: sortedLabs.filter((l) => l.runnable).length,
    invalidCount: sortedLabs.filter((l) => !l.valid).length
  }
}

/**
 * @param {string} labId
 */
export function getLab(labId) {
  assertSafeLabId(labId)
  const loc = resolveLabCatalogLocation(labId)
  if (!loc) {
    throw new Error(`Lab not found: ${labId}`)
  }
  const labsRoot = loc.labsRoot
  const folder = loc.folder

  const entry = loadLabDefinition(labsRoot, folder)
  if (!entry.valid || !entry.lab) {
    throw new Error(entry.errors[0] ?? `Lab ${labId} is invalid`)
  }

  return {
    ...entry.metadata,
    valid: entry.valid,
    runnable: entry.runnable,
    available: entry.runnable,
    tasks: entry.lab.tasks,
    hints: entry.lab.hints ?? [],
    questions: entry.lab.questions ?? [],
    objectives: entry.lab.objectives ?? [],
    objectivesPublic: entry.lab.objectivesPublic ?? [],
    setupSecrets: entry.lab.setupSecrets ?? [],
    credentials: entry.lab.credentials
      ? {
          username: entry.lab.credentials.username ?? null,
          host: entry.lab.credentials.host ?? '127.0.0.1',
          generatedPerSession: true
        }
      : { username: null, host: '127.0.0.1', generatedPerSession: true },
    docker: entry.lab.docker ?? null,
    runtime: entry.lab.runtime,
    labMode: resolveLabMode(entry.lab),
    workstation: entry.lab.workstation ?? null,
    labGuides: entry.lab.labGuides ?? null,
    safetyNotes: entry.lab.safetyNotes ?? null,
    validation: entry.lab.validation,
    warnings: entry.warnings,
    hasDockerfile: entry.hasDockerfile,
    hasReadme: entry.hasReadme,
    safetyMode: getSafetyModeConfig(),
    ticket: entry.lab.ticket ?? null,
    incident: entry.lab.incident ?? null,
    attachments: entry.lab.attachments ?? [],
    objectiveDisplay: entry.lab.objectiveDisplay ?? 'visible',
    source: loc.source,
    bundled: entry.lab.bundled === true || loc.bundled === true,
    tags: entry.lab.tags ?? [],
    postLabReview: entry.lab.postLabReview ?? null,
    commandTracking: entry.lab.commandTracking ?? null,
    immersion: entry.lab.immersion ?? null,
    hasTicket: labHasIncidentBriefing(entry.lab)
  }
}

/**
 * @param {string} labId
 */
export function getIncidentBriefing(labId) {
  assertSafeLabId(labId)
  const loc = resolveLabCatalogLocation(labId)
  if (!loc) {
    throw new Error(`Lab not found: ${labId}`)
  }
  const entry = loadLabDefinition(loc.labsRoot, loc.folder)
  if (!entry.valid || !entry.lab) {
    throw new Error(entry.errors[0] ?? `Lab ${labId} is invalid`)
  }
  return getIncidentBriefingForLab(labId, entry.lab)
}

export { getIncidentBriefingForLab, labHasIncidentBriefing, readLabAttachment }

/**
 * @param {object} lab
 * @param {string} labsRoot
 * @param {string} labId
 */
/**
 * Resolve Docker build context for a lab (supports buildPath ".." → labs tree root).
 * @param {string} labsTreeRoot
 * @param {string} labsRoot
 * @param {string} labId
 * @param {{ buildPath?: string }} dockerSpec
 */
function resolveLabBuildContext(labsTreeRoot, labsRoot, labId, dockerSpec) {
  const labDir = path.join(labsRoot, labId)
  const buildPathRel = dockerSpec.buildPath ?? '.'
  if (buildPathRel === '..') {
    return {
      buildContext: labsTreeRoot,
      dockerfilePath: path.join(labDir, 'Dockerfile'),
      usesSharedTree: true
    }
  }
  const buildContext = path.resolve(labDir, buildPathRel)
  return {
    buildContext,
    dockerfilePath: path.join(buildContext, 'Dockerfile'),
    usesSharedTree: false
  }
}

/**
 * Labs with buildPath ".." share scripts from labs/common. Copy into userData so Docker
 * never has to read build contexts from Program Files or other awkward host paths.
 * @param {string} labsTreeRoot
 * @param {string} labDir
 * @param {string} labId
 */
function materializeSharedLabBuildContext(labsTreeRoot, labDir, labId) {
  const commonSrc = path.join(labsTreeRoot, 'common')
  if (!fs.existsSync(commonSrc)) {
    throw new Error(`Lab common scripts missing at ${commonSrc}`)
  }
  if (!fs.existsSync(path.join(labDir, 'Dockerfile'))) {
    throw new Error(`Dockerfile missing for ${labId}`)
  }

  const labRel = path.relative(labsTreeRoot, labDir)
  if (!labRel || labRel.startsWith('..') || path.isAbsolute(labRel)) {
    throw new Error(`Lab folder must live under the labs tree root (${labsTreeRoot})`)
  }

  const stagingRoot = path.join(getUserDataRoot(), 'lab-build-contexts', labId)
  const labDest = path.join(stagingRoot, labRel)

  fs.rmSync(stagingRoot, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(labDest), { recursive: true })
  fs.cpSync(commonSrc, path.join(stagingRoot, 'common'), { recursive: true })
  fs.cpSync(labDir, labDest, { recursive: true })

  return {
    buildContext: stagingRoot,
    dockerfilePath: path.join(labDest, 'Dockerfile')
  }
}

/**
 * @param {object} lab
 * @param {string} labsRoot
 * @param {string} labId
 * @param {{ emit?: Function, checkCancel?: Function }} [progress]
 * @param {string | null | undefined} [sessionDockerRuntime]
 */
async function ensureLabImage(lab, loc, progress, sessionDockerRuntime = null) {
  progress?.checkCancel?.()
  const dockerOpts = sessionDockerRuntime
    ? { runtime: toDockerManagerRuntime(sessionDockerRuntime), dockerRuntime: toDockerManagerRuntime(sessionDockerRuntime) }
    : {}
  const dockerSpec = lab.docker
  const image = dockerSpec.image
  const labId = loc.folder
  const localTag = `sysadmin-game/${labId}:latest`
  const tag = image || localTag

  if (dockerSpec.buildPath !== undefined || fs.existsSync(path.join(loc.labsRoot, labId, 'Dockerfile'))) {
    const labDir = path.join(loc.labsRoot, labId)
    let { buildContext, dockerfilePath } = resolveLabBuildContext(
      loc.labsTreeRoot,
      loc.labsRoot,
      labId,
      dockerSpec
    )
    if (dockerSpec.buildPath === '..') {
      ;({ buildContext, dockerfilePath } = materializeSharedLabBuildContext(
        loc.labsTreeRoot,
        labDir,
        labId
      ))
    }
    if (!fs.existsSync(buildContext)) {
      throw new Error(`Build path not found: ${dockerSpec.buildPath ?? '.'}`)
    }
    if (!fs.existsSync(dockerfilePath)) {
      throw new Error('Dockerfile missing for local build')
    }

    const exists = await dockerManager.imageExists(tag, dockerOpts)
    const entrypointVersion = exists
      ? await dockerManager.getLabImageEntrypointVersion(tag, dockerOpts)
      : null
    const needsRebuild = !exists || entrypointVersion !== LAB_IMAGE_ENTRYPOINT_VERSION

    if (needsRebuild) {
      progress?.emit?.('build_image', {
        status: 'running',
        message: exists
          ? 'Rebuilding lab image (credential entrypoint updated)…'
          : 'Building lab image (this may take a minute)…'
      })
      logger.info('labManager', 'Building lab image', {
        labId,
        tag,
        buildContext,
        dockerfilePath,
        entrypointVersion,
        requiredVersion: LAB_IMAGE_ENTRYPOINT_VERSION,
        noCache: exists === true
      })
      await dockerManager.buildImage(buildContext, tag, {
        labId,
        resourceRole: ROLE_TARGET,
        lifecycle: LIFECYCLE_PERSISTENT,
        dockerfile: dockerfilePath,
        noCache: exists === true,
        entrypointVersion: LAB_IMAGE_ENTRYPOINT_VERSION,
        ...dockerOpts
      })
      progress?.emit?.('build_image', { status: 'success', message: 'Lab image built.' })
    } else {
      progress?.emit?.('build_image', { status: 'success', message: 'Using cached lab image.' })
      logger.info('labManager', 'Using existing lab image', { labId, tag })
    }
    return tag
  }

  progress?.emit?.('build_image', { status: 'running', message: 'Pulling lab image…' })
  const exists = await dockerManager.imageExists(tag, dockerOpts)
  if (!exists) {
    await dockerManager.pullImage(tag, dockerOpts)
  }
      progress?.emit?.('build_image', { status: 'success', message: 'Lab image ready.' })
  return tag
}

/**
 * @param {object} lab
 * @param {string} draftRootAbs absolute path containing lab.json parent
 * @param {string} resolvedImageTag
 * @param {string} [sessionId]
 * @param {string | null | undefined} [sessionDockerRuntime]
 */
async function ensureDraftDockerImage(lab, draftRootAbs, resolvedImageTag, sessionId, sessionDockerRuntime = null) {
  const dockerOpts = sessionDockerRuntime
    ? { runtime: toDockerManagerRuntime(sessionDockerRuntime), dockerRuntime: toDockerManagerRuntime(sessionDockerRuntime) }
    : {}
  const dockerSpec = lab.docker
  const buildRel = dockerSpec.buildPath ?? '.'
  const buildPath = path.resolve(draftRootAbs, buildRel)
  if (!fs.existsSync(buildPath)) {
    throw new Error(`Build path not found: ${buildRel}`)
  }
  const dockerfile = path.join(buildPath, 'Dockerfile')
  if (!fs.existsSync(dockerfile)) {
    throw new Error('Dockerfile missing in draft build path')
  }

  logger.info('labManager', 'Building draft lab image', { labId: lab.id, tag: resolvedImageTag, buildPath })
  await dockerManager.buildImage(buildPath, resolvedImageTag, {
    labId: lab.id,
    sessionId,
    resourceRole: ROLE_TARGET,
    lifecycle: LIFECYCLE_EPHEMERAL,
    ...dockerOpts
  })
  return resolvedImageTag
}

/**
 * Start a disposable Builder test session from a draft folder under userData.
 * @param {{ draftRootPath: string, existingSessionId?: string }} opts
 */
export async function startDraftLabSession(opts) {
  const draftRootPath = path.resolve(opts.draftRootPath)
  const labJsonPath = path.join(draftRootPath, 'lab.json')
  if (!fs.existsSync(labJsonPath)) {
    throw new Error('Draft folder must contain lab.json')
  }

  const lab = JSON.parse(fs.readFileSync(labJsonPath, 'utf8'))
  const vr = validateLabPayload(lab, { skipFolderMatch: true, mode: 'strict' })
  if (!vr.valid) {
    throw new Error(vr.errors[0] ?? 'Invalid lab.json')
  }
  assertSafeLabId(lab.id)

  const dk = await dockerManager.checkReady()
  if (!dk.ready) {
    throw new Error(dk.message || 'Docker is not ready')
  }

  if (lab.runtime !== 'docker') {
    throw new Error('Only Docker drafts can run in Builder test.')
  }

  const sessionId = opts.existingSessionId ?? createSessionId()
  if (opts.existingSessionId) {
    assertSafeSessionId(opts.existingSessionId)
  }

  const track = {}
  const { networkName, networkSubnet } = await prepareSessionNetworkAndRuntime(
    lab,
    sessionId,
    lab.id,
    track,
    {}
  )

  const folderSlug = path.basename(draftRootPath).replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase().replace(/^-+/, '')
  const slug = folderSlug || 'draft'
  const defaultTag = `sysadmin-game/draft-${slug.slice(0, 40)}:latest`
  const imageTag = lab.docker.image?.trim() || defaultTag

  await ensureDraftDockerImage(lab, draftRootPath, imageTag, sessionId, track.sessionDockerRuntime)

  const containerName = buildContainerName(lab.id, sessionId)

  const provisioned = await provisionDockerLabEnvironment({
    lab,
    labId: lab.id,
    labRootPath: draftRootPath,
    sessionId,
    image: imageTag,
    containerName,
    dockerEnv: lab.docker.env ?? {},
    networkName,
    sessionDockerRuntime: track.sessionDockerRuntime,
    partialRef: track
  })

  const { credentials, targetResult, helperResult } = provisioned
  const portBundle = await buildSessionPortBundle(lab, targetResult)
  const connection = buildSessionConnection(credentials, provisioned.internalRoute)
  const helper = buildSessionHelperState(provisioned, containerName, networkName)
  if (networkSubnet) {
    helper.networkSubnet = networkSubnet
  }

  /** @type {LabSession} */
  const session = {
    sessionId,
    labId: lab.id,
    containerName,
    containerId: helperResult.containerId,
    status: 'running',
    portSpecs: portBundle.portSpecs,
    ports: portBundle.ports,
    serviceRoutes: portBundle.serviceRoutes,
    connection,
    credentials: {
      username: credentials.username,
      password: credentials.password,
      host: connection?.host ?? null,
      sshPort: connection?.port ?? INTERNAL_SSH_CONTAINER_PORT,
      targetInternalIp: provisioned.targetInternalIp ?? null,
      sshReady: provisioned.sshReady === true,
      labOnly: true,
      internalOnly: true
    },
    objectives: lab.objectives ?? [],
    image: imageTag,
    startedAt: new Date().toISOString(),
    builderTest: true,
    helper,
    sshReady: provisioned.sshReady === true,
    draftRootPath,
    embeddedLab: lab,
    publicBind: targetResult.publicBind === true,
    variationSummary: getSessionVariationSummary(sessionId),
    workstationCredentials: sanitizeWorkstationCredentialsForClient(provisioned.workstationCredentials)
  }

  registerSessionHostPorts(sessionId, portBundle.ports)
  sessions.set(sessionId, session)
  initSessionTelemetry(sessionId)
  initSessionObjectives(sessionId, lab)

  logger.info('labManager', 'Draft lab test session started', { labId: lab.id, sessionId })

  return {
    sessionId,
    labId: lab.id,
    containerName: helper.containerName,
    containerId: helperResult.containerId,
    status: session.status,
    ports: session.ports,
    serviceRoutes: session.serviceRoutes,
    connection: session.connection,
    credentials: session.credentials,
    image: imageTag,
    builderTest: true,
    message:
      'Builder test mode — no progress will be saved. Temporary credentials only — check / validate the lab inside the sandbox when ready.'
  }
}
/**
 * Remove partial mission resources after failed or canceled startup.
 * @param {string} sessionId
 * @param {string} labId
 * @param {object} [partial]
 */
export async function abortMissionStartup(sessionId, labId, partial = {}, options = {}) {
  assertSafeSessionId(sessionId)
  const preserveContainers = options.preserveContainers === true
  const existing = sessions.get(sessionId)
  if (existing) {
    await teardownLabSession(existing, { removeImage: false })
    sessions.delete(sessionId)
    return
  }

  if (preserveContainers) {
    logger.info('labManager', 'Preserving failed startup containers for diagnostics', {
      sessionId,
      labId,
      targetName: partial.targetContainerName ?? partial.containerName,
      helperName: partial.helperContainerName,
      networkName: partial.networkName ?? buildSessionNetworkName(sessionId),
      targetContainerId: partial.targetContainerId ?? null,
      helperContainerId: partial.helperContainerId ?? null
    })
    return { preserved: true }
  }

  clearSessionObjectives(sessionId)
  clearSessionTelemetry(sessionId)
  clearSessionVariation(sessionId)
  clearDesktopRecoverySnapshot(sessionId)
  detachTerminalsForSession(sessionId)
  closeLabTerminalWindow(sessionId)

  const cleanup = await cleanupSessionResources(sessionId, {
    labId,
    dockerRuntime:
      partial.sessionDockerRuntime != null
        ? toDockerManagerRuntime(partial.sessionDockerRuntime)
        : toDockerManagerRuntime(partial.desktopDockerRuntime) ?? partial.desktopDockerRuntime ?? null,
    removeEphemeralImages: true,
    removePersistentImages: false,
    clearSessionState: true,
    force: options.force === true
  })

  logger.info('labManager', 'Aborted partial mission startup', { sessionId, labId, partial, cleanupOk: cleanup.ok })
  return cleanup
}

/**
 * @param {string} labId
 * @param {{ existingSessionId?: string, progress?: ReturnType<import('./missionStartupProgress.js').createMissionStartupProgress>, partialRef?: object }} [options]
 */
async function startLabSession(labId, options = {}) {
  const { existingSessionId, progress, partialRef } = options
  const track = partialRef ?? {}

  progress?.emit?.('prepare', { status: 'running' })
  progress?.checkCancel?.()

  assertSafeLabId(labId)
  progress?.emit?.('prepare', { status: 'success' })

  const loc = resolveLabCatalogLocation(labId)
  if (!loc) {
    throw new Error(`Lab ${labId} not found`)
  }
  const labsRoot = loc.labsRoot
  const entry = loadLabDefinition(labsRoot, loc.folder)
  const lab = entry.lab
  if (!lab || !entry.valid) {
    throw new Error(entry.errors[0] ?? `Lab ${labId} is invalid`)
  }

  if (lab.runtime !== 'docker') {
    throw new Error('Only Docker labs can be started. VM runtime is not supported.')
  }

  const readiness = await dockerManager.checkReady()
  if (!readiness.ready) {
    throw new Error(readiness.message || 'Docker is not ready')
  }
  if (!entry.runnable) {
    throw new Error(entry.warnings[0] ?? 'Lab is not runnable')
  }

  assertLabUnlocked(labId, { activeLabIds: getActiveLabIds() })

  const sessionId = existingSessionId ?? createSessionId()
  track.sessionId = sessionId
  if (existingSessionId) {
    assertSafeSessionId(existingSessionId)
  }

  progress?.emit?.('credentials', { status: 'running' })
  progress?.checkCancel?.()
  const credentials = createMissionSessionCredentials(lab, sessionId)
  track.credentialsCreated = true
  const variation = createSessionVariation(lab, sessionId, credentials)
  progress?.emit?.('credentials', { status: 'success' })

  progress?.emit?.('network', { status: 'running' })
  progress?.checkCancel?.()
  const { networkName, networkSubnet } = await prepareSessionNetworkAndRuntime(lab, sessionId, labId, track, {
    workstationPreference: options.workstationPreference,
    workstationProfileId: options.workstationProfileId
  })
  progress?.emit?.('network', { status: 'success', message: `Lab network ready (${networkSubnet}).` })

  const containerName = buildContainerName(labId, sessionId)
  track.targetContainerName = containerName
  track.containerName = containerName
  track.helperContainerName = `sysadmin-game-workstation-${labId}-${sessionId}`

  const image = await ensureLabImage(lab, loc, progress, track.sessionDockerRuntime)
  progress?.checkCancel?.()

  const provisioned = await provisionDockerLabEnvironment({
    lab,
    labId,
    labRootPath: path.join(labsRoot, entry.folder),
    sessionId,
    image,
    containerName,
    dockerEnv: lab.docker.env ?? {},
    networkName,
    credentials,
    variation,
    progress,
    partialRef: track,
    sessionDockerRuntime: track.sessionDockerRuntime,
    workstationPreference: options.workstationPreference,
    workstationProfileId: options.workstationProfileId,
    isoPath: options.isoPath ?? options.selectedWorkstationIsoPath,
    selectedWorkstationIsoPath: options.selectedWorkstationIsoPath,
    selectedWorkstationIsoType: options.selectedWorkstationIsoType
  })

  const { targetResult, helperResult } = provisioned
  const isLocalTerminal = provisioned.isLocalTerminal === true
  const isWslLocalTerminal = provisioned.isWslLocalTerminal === true
  const portBundle = await buildSessionPortBundle(lab, targetResult)
  const helper = buildSessionHelperState(provisioned, containerName, networkName)
  if (track.networkSubnet) {
    helper.networkSubnet = track.networkSubnet
  }
  const isDesktopWorkstation = isDesktopWorkstationHelper(helper)
  const isWindowsDesktopWorkstation = isWindowsDesktopWorkstationHelper(helper)
  const accessMode = resolveLabAccessMode(lab)
  const { connection, routes: connectionRoutes } = buildLabConnectionRoutes({
    credentials,
    internalRoute: provisioned.internalRoute,
    ports: portBundle.ports,
    isVmWorkstation: helper.workstationRuntime === 'vm',
    isDesktopWorkstation,
    isWindowsDesktopWorkstation,
    isLocalTerminal,
    isWslLocalTerminal,
    accessMode
  })

  progress?.emit?.('objectives', { status: 'running' })
  progress?.checkCancel?.()

  const desktopTiming = buildDesktopLabSessionTiming(
    isDesktopWorkstation,
    provisioned.workstationReadiness
  )

  /** @type {LabSession} */
  const session = {
    sessionId,
    labId,
    containerName,
    containerId: provisioned.targetOnly === true ? targetResult.containerId : helperResult.containerId,
    status: desktopTiming.status,
    runtime: 'docker',
    labMode: resolveLabMode(lab),
    portSpecs: portBundle.portSpecs,
    ports: portBundle.ports,
    serviceRoutes: portBundle.serviceRoutes,
    connection,
    connectionRoutes,
    credentials: {
      username: credentials.username,
      password: credentials.password,
      host: connection?.host ?? null,
      sshPort: connection?.port ?? INTERNAL_SSH_CONTAINER_PORT,
      targetInternalIp: provisioned.targetInternalIp ?? null,
      sshReady: provisioned.sshReady === true,
      labOnly: true,
      internalOnly: true
    },
    objectives: lab.objectives ?? [],
    image,
    startedAt: desktopTiming.startedAt,
    activated: desktopTiming.activated,
    awaitingDesktopEnter: desktopTiming.awaitingDesktopEnter,
    accessMode,
    securitySimulation: isSecuritySimulationLab(lab),
    securitySubcategory: lab.securitySubcategory ?? null,
    helper,
    selectedWorkstation: {
      id: helper.workstationProfileId,
      name: helper.workstationProfileName,
      runtime: helper.workstationRuntime ?? 'docker',
      provider: helper.workstationProvider,
      type: helper.workstationPlatform
    },
    sshReady: provisioned.sshReady === true,
    publicBind: targetResult.publicBind === true,
    variationSummary: getSessionVariationSummary(sessionId),
    desktopReadiness: provisioned.workstationReadiness ?? null,
    workstationCredentials: sanitizeWorkstationCredentialsForClient(provisioned.workstationCredentials)
  }

  registerSessionHostPorts(sessionId, portBundle.ports)
  sessions.set(sessionId, session)
  initSessionTelemetry(sessionId)
  if (!desktopTiming.awaitingDesktopEnter) {
    initSessionObjectives(sessionId, lab)
  }
  clearDesktopRecoverySnapshot(sessionId)
  progress?.emit?.('objectives', { status: 'success' })
  progress?.emit?.('ready', {
    status: 'success',
    message: 'Lab ready.'
  })
  logger.info('labManager', 'Lab session started', { labId, sessionId, containerName, ports: portBundle.ports })

  maybeNotifyLabDeploymentReady(labId, lab, sessionId)

  let message = desktopTiming.awaitingDesktopEnter
    ? 'Lab environment is ready. Click Start lab in the app to begin.'
    : 'Lab active. Complete lab objectives, then check / validate.'
  if (targetResult.publicBind) {
    message =
      'Lab active with Developer Mode public port binding. Prefer local-only access when possible.'
  }
  if (getAllSettings().developerMode === true && helper.startupWarnings?.length) {
    message = `${message} ${helper.startupWarnings.join(' ')}`
  }

  return sanitizeSessionForClient(
    {
      sessionId,
      labId,
      containerName: helper.containerName,
      containerId: helperResult.containerId,
      status: session.status,
      runtime: session.runtime,
      labMode: session.labMode,
      ports: session.ports,
      serviceRoutes: session.serviceRoutes,
      connection: session.connection,
      connectionRoutes: session.connectionRoutes,
      credentials: session.credentials,
      workstationCredentials: session.workstationCredentials,
      helper: session.helper,
      sshReady: session.sshReady,
      startedAt: session.startedAt,
      activated: session.activated,
      awaitingDesktopEnter: session.awaitingDesktopEnter === true,
      desktopReadiness: session.desktopReadiness,
      image,
      publicBind: session.publicBind === true,
      message
    },
    lab
  )
}

/**
 * @param {string} labId
 */
/**
 * @param {string} labId
 * @param {{ progress?: ReturnType<import('./missionStartupProgress.js').createMissionStartupProgress>, partialRef?: object }} [options]
 */
export async function startLab(labId, options = {}) {
  return startLabSession(labId, options)
}


/**
 * @param {string} sessionId
 */
export function getSessionState(sessionId) {
  assertSafeSessionId(sessionId)
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`)
  }
  return { ...session }
}

/**
 * Session state safe for renderer IPC (redacts credentials in discover mode).
 * @param {string} sessionId
 */
export function getSanitizedSessionState(sessionId) {
  const session = getSessionState(sessionId)
  const lab = resolveLabFromSession(session)
  return sanitizeSessionForClient(session, lab)
}

/**
 * Activate a desktop lab session after the workstation is ready (starts timer, objectives).
 * @param {string} sessionId
 */
export function activateLabSession(sessionId) {
  assertSafeSessionId(sessionId)
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`)
  }
  if (session.activated === true && session.startedAt) {
    return getSanitizedSessionState(sessionId)
  }
  const lab = resolveLabFromSession(session)
  session.status = 'running'
  session.activated = true
  session.awaitingDesktopEnter = false
  if (!session.startedAt) {
    session.startedAt = new Date().toISOString()
  }
  session.objectives = lab.objectives ?? []
  initSessionObjectives(sessionId, lab)
  logger.info('labManager', 'Desktop lab session activated', { sessionId, labId: session.labId })
  return getSanitizedSessionState(sessionId)
}

/**
 * Re-probe exposed service routes (localhost HTTP/TCP checks).
 * @param {string} sessionId
 */
export async function refreshServiceRoutes(sessionId) {
  assertSafeSessionId(sessionId)
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`)
  }
  if (session.status !== 'running') {
    throw new Error('Lab session is not running')
  }

  const lab = resolveLabFromSession(session)
  const portSpecs =
    session.portSpecs ?? applySessionPortPolicy(normalizeLabPortDefinitions(lab.docker?.ports))

  const targetContainerId = session.helper?.targetContainerId ?? null

  let mappedPorts = session.ports ?? []
  if (targetContainerId) {
    const defs = portSpecs
      .filter((def) => def.exposeToHost === true)
      .map((def) => ({
        container: def.container,
        protocol: def.protocol ?? 'tcp',
        purpose: def.purpose,
        locked: false,
        bindAll: def.bindAll === true
      }))
    if (defs.length > 0) {
      mappedPorts = await dockerManager.inspectContainerPortMappings(targetContainerId, defs)
    }
  }

  const ports = enrichPortMappings(portSpecs, normalizeSessionPorts(mappedPorts))
  let serviceRoutes = buildServiceRoutes(portSpecs, ports)
  serviceRoutes = await probeAllServiceRoutes(serviceRoutes)

  session.ports = ports
  session.portSpecs = portSpecs
  session.serviceRoutes = serviceRoutes
  sessions.set(sessionId, session)

  return { serviceRoutes, ports }
}

/**
 * Re-inspect workstation container published ports (noVNC / RDP / VNC).
 * @param {string} sessionId
 */
export async function refreshWorkstationAccessRoutes(sessionId) {
  assertSafeSessionId(sessionId)
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`)
  }
  if (session.status !== 'running') {
    throw new Error('Lab session is not running')
  }

  const helperContainerId = session.helper?.containerId ?? session.containerId ?? null
  if (!helperContainerId) {
    return {
      workstationAccessRoutes: session.helper?.workstationAccessRoutes ?? [],
      workstationDesktopUrl: session.helper?.workstationDesktopUrl ?? null
    }
  }

  const dockerRuntime = session.helper?.workstationDesktopDockerRuntime ?? null
  const webViewerPort = getWorkstationDesktopConfig().webViewerPort
  const workstationAccessRoutes = await inspectWorkstationAccessRoutes(helperContainerId, {
    dockerRuntime,
    webViewerPort
  })
  const novnc = workstationAccessRoutes.find((r) => r.type === 'novnc')
  const workstationDesktopUrl = novnc?.url ?? session.helper?.workstationDesktopUrl ?? null

  if (session.helper) {
    session.helper.workstationAccessRoutes = workstationAccessRoutes
    if (workstationDesktopUrl) {
      session.helper.workstationDesktopUrl = workstationDesktopUrl
    }
  }
  sessions.set(sessionId, session)

  return { workstationAccessRoutes, workstationDesktopUrl }
}

/**
 * Pick the Docker CLI context used when tearing down a lab session.
 * @param {import('./labManager.js').LabSession | null | undefined} session
 */
function resolveLabSessionCleanupRuntime(session) {
  const sessionRuntime =
    session?.helper?.sessionDockerRuntime != null
      ? toDockerManagerRuntime(session.helper.sessionDockerRuntime)
      : null
  const desktopRuntime =
    session?.helper?.workstationDesktopDockerRuntime != null
      ? toDockerManagerRuntime(session.helper.workstationDesktopDockerRuntime)
      : null

  if (
    isSessionWslDockerRuntime(session?.helper?.sessionDockerRuntime) ||
    isSessionWslDockerRuntime(session?.helper?.workstationDesktopDockerRuntime) ||
    desktopRuntime === DOCKER_RUNTIME_WSL_KVM
  ) {
    return DOCKER_RUNTIME_WSL_KVM
  }

  return sessionRuntime ?? desktopRuntime
}

/**
 * @param {LabSession} session
 * @param {{ removeImage?: boolean, force?: boolean }} [options]
 */
async function teardownLabSession(session, options = {}) {
  const { sessionId, labId, image } = session
  const keepLabImagesCache = getAllSettings().keepLabImagesCache === true
  const removePersistentImages = options.removeImage ?? keepLabImagesCache !== true

  closeLabTerminalWindow(sessionId)
  detachTerminalsForSession(sessionId)
  clearSessionObjectives(sessionId)
  clearSessionTelemetry(sessionId)
  clearSessionVariation(sessionId)

  const dockerRuntime = resolveLabSessionCleanupRuntime(session)

  const cleanup = await cleanupSessionResources(sessionId, {
    labId,
    sessionImage: image,
    dockerRuntime,
    force: options.force === true,
    removeEphemeralImages: true,
    removePersistentImages,
    clearSessionState: true
  })

  return cleanup
}

/**
 * @param {string} sessionId
 */
export async function stopLab(sessionId, options = {}) {
  const session = getSessionState(sessionId)
  const cleanup = await teardownLabSession(session, {
    force: options.force === true,
    removeImage: options.removeImage
  })

  if (cleanup.ok || options.force) {
    sessions.delete(sessionId)
  }

  return {
    sessionId,
    status: cleanup.ok ? 'stopped' : 'cleanup_incomplete',
    cleanup,
    verified: cleanup.verified,
    partial: !cleanup.ok,
    message: cleanup.ok
      ? 'Lab stopped. Temporary progress and environment removed.'
      : 'Lab ended but cleanup incomplete.'
  }
}

/**
 * @param {string} sessionId
 */
export async function resetLab(sessionId) {
  const existing = getSessionState(sessionId)
  if (existing.builderTest && existing.draftRootPath) {
    await teardownLabSession(existing)
    sessions.delete(sessionId)
    const restarted = await startDraftLabSession({
      draftRootPath: existing.draftRootPath,
      existingSessionId: sessionId
    })
    return {
      ...restarted,
      message: 'Lab reset — fresh builder test container (no XP saved).'
    }
  }

  const labId = existing.labId

  await teardownLabSession(existing)
  sessions.delete(sessionId)

  const restarted = await startLabSession(labId, sessionId)
  return {
    ...restarted,
    message: 'Lab reset — fresh container and credentials created.'
  }
}

/**
 * Tear down environment after successful validation / XP award.
 * @param {string} sessionId
 */
export async function completeAndTeardownLab(sessionId) {
  const session = getSessionState(sessionId)
  const cleanup = await teardownLabSession(session)
  if (cleanup.ok) {
    sessions.delete(sessionId)
  }
  return {
    sessionId,
    status: cleanup.ok ? 'completed' : 'cleanup_incomplete',
    cleanup,
    message: cleanup.ok
      ? 'Lab complete. Player progress saved. Lab environment removed.'
      : 'Lab complete but cleanup incomplete.'
  }
}

/**
 * @param {string} sessionId
 */
export async function destroyLab(sessionId) {
  const session = getSessionState(sessionId)
  const cleanup = await teardownLabSession(session, { force: true })
  sessions.delete(sessionId)
  return { sessionId, status: 'destroyed', cleanup }
}

/**
 * @param {string} sessionId
 */
export async function listLabSessionResources(sessionId) {
  assertSafeSessionId(sessionId)
  return collectSessionResources(sessionId)
}

/**
 * @param {string} sessionId
 * @param {{ force?: boolean }} [options]
 */
export async function retryLabSessionCleanup(sessionId, options = {}) {
  assertSafeSessionId(sessionId)
  const session = sessions.get(sessionId)
  const cleanup = await cleanupSessionResources(sessionId, {
    labId: session?.labId,
    sessionImage: session?.image,
    dockerRuntime:
      session?.helper?.sessionDockerRuntime != null
        ? toDockerManagerRuntime(session.helper.sessionDockerRuntime)
        : session?.helper?.workstationDesktopDockerRuntime ?? null,
    force: options.force === true,
    removeEphemeralImages: true,
    removePersistentImages: getAllSettings().keepLabImagesCache !== true,
    clearSessionState: !session
  })
  if (cleanup.ok && session) {
    sessions.delete(sessionId)
  }
  return cleanup
}

/**
 * @returns {Promise<Awaited<ReturnType<import('./desktopSetupRecovery.js').scanRecoverableDesktopSetups>>>}
 */
export async function listRecoverableDesktopLabSetups() {
  return scanRecoverableDesktopSetups()
}

/**
 * Resume waiting for an in-progress desktop setup after app restart.
 * @param {string} sessionId
 * @param {{ progress?: ReturnType<import('./missionStartupProgress.js').createMissionStartupProgress> }} [options]
 */
export async function resumeDesktopLabSetup(sessionId, options = {}) {
  assertSafeSessionId(sessionId)
  if (sessions.has(sessionId)) {
    throw new Error('Lab session is already active.')
  }

  const snapshot = loadDesktopRecoverySnapshot(sessionId)
  if (!snapshot?.helperContainerId || !snapshot.labId) {
    throw new Error('No desktop setup recovery data for this session.')
  }

  const credentials = loadMissionSessionCredentials(sessionId)
  if (!credentials) {
    throw new Error('Session credentials not found — cannot resume desktop setup.')
  }

  if (snapshot.variation) {
    restoreSessionVariation(sessionId, snapshot.variation)
  }

  const labsRoot = getLabsPath()
  const entry = loadLabDefinition(labsRoot, snapshot.labId)
  const lab = entry.lab
  if (!lab) {
    throw new Error(`Lab ${snapshot.labId} not found`)
  }

  const workstationProfile = getWorkstationProfile(snapshot.workstationProfileId, lab)
  const progress = options.progress

  progress?.emit?.('prepare', { status: 'success', message: 'Reconnecting to desktop setup…' })
  progress?.emit?.('desktop_readiness', {
    status: 'running',
    message: 'Resuming desktop setup — existing install progress preserved.',
    percent: 88
  })

  const workstationReadiness = await waitForDesktopWorkstationReady({
    containerId: snapshot.helperContainerId,
    profile: workstationProfile,
    dockerRuntime: snapshot.dockerRuntime ?? null,
    progress,
    startedAtMs: snapshot.readinessStartedAt ?? Date.now(),
    sessionId
  })

  const targetResult = {
    containerId: snapshot.targetContainerId,
    ports: snapshot.targetPorts ?? [],
    publicBind: false
  }
  const helperResult = {
    containerId: snapshot.helperContainerId,
    ports: snapshot.helperPorts ?? [],
    accessRoutes: workstationReadiness.accessRoutes ?? [],
    desktopUrl: workstationReadiness.desktopUrl ?? null
  }

  const provisioned = {
    credentials,
    targetResult,
    helperResult,
    helperName: snapshot.helperName,
    startupWarnings: snapshot.startupWarnings ?? [],
    hasSsh: snapshot.hasSsh === true,
    sshReady: snapshot.sshReady === true,
    internalRoute: snapshot.hasSsh
      ? getInternalLabSshRoute(
          SANDBOX_SSH_TARGET,
          INTERNAL_SSH_CONTAINER_PORT,
          snapshot.targetInternalIp
        )
      : null,
    targetInternalIp: snapshot.targetInternalIp ?? null,
    isLocalTerminal: snapshot.isLocalTerminal === true,
    isWslLocalTerminal: snapshot.isWslLocalTerminal === true,
    workstationProfile,
    workstationReadiness,
    workstationCredentials: credentials.workstationCredentials ?? null
  }

  const labId = snapshot.labId
  const containerName = snapshot.containerName
  const networkName = snapshot.networkName ?? buildSessionNetworkName(sessionId)
  const image = snapshot.image

  const portBundle = await buildSessionPortBundle(lab, targetResult)
  const helper = buildSessionHelperState(provisioned, containerName, networkName)
  if (track.networkSubnet) {
    helper.networkSubnet = track.networkSubnet
  }
  const isLocalTerminal = provisioned.isLocalTerminal === true
  const isWslLocalTerminal = provisioned.isWslLocalTerminal === true
  const accessMode = resolveLabAccessMode(lab)
  const { connection, routes: connectionRoutes } = buildLabConnectionRoutes({
    credentials,
    internalRoute: provisioned.internalRoute,
    ports: portBundle.ports,
    isVmWorkstation: helper.workstationRuntime === 'vm',
    isDesktopWorkstation: isDesktopWorkstationHelper(helper),
    isWindowsDesktopWorkstation: isWindowsDesktopWorkstationHelper(helper),
    isLocalTerminal,
    isWslLocalTerminal,
    accessMode
  })

  const isDesktopWorkstation = isDesktopWorkstationHelper(helper)
  const desktopTiming = buildDesktopLabSessionTiming(isDesktopWorkstation, workstationReadiness)

  /** @type {LabSession} */
  const session = {
    sessionId,
    labId,
    containerName,
    containerId: provisioned.targetOnly === true ? targetResult.containerId : helperResult.containerId,
    status: desktopTiming.status,
    runtime: 'docker',
    labMode: resolveLabMode(lab),
    portSpecs: portBundle.portSpecs,
    ports: portBundle.ports,
    serviceRoutes: portBundle.serviceRoutes,
    connection,
    connectionRoutes,
    credentials: {
      username: credentials.username,
      password: credentials.password,
      host: connection?.host ?? null,
      sshPort: connection?.port ?? INTERNAL_SSH_CONTAINER_PORT,
      targetInternalIp: provisioned.targetInternalIp ?? null,
      sshReady: provisioned.sshReady === true,
      labOnly: true,
      internalOnly: true
    },
    objectives: lab.objectives ?? [],
    image,
    startedAt: desktopTiming.startedAt,
    activated: desktopTiming.activated,
    awaitingDesktopEnter: desktopTiming.awaitingDesktopEnter,
    accessMode,
    securitySimulation: isSecuritySimulationLab(lab),
    securitySubcategory: lab.securitySubcategory ?? null,
    helper,
    selectedWorkstation: {
      id: helper.workstationProfileId,
      name: helper.workstationProfileName,
      runtime: helper.workstationRuntime ?? 'docker',
      provider: helper.workstationProvider,
      type: helper.workstationPlatform
    },
    sshReady: provisioned.sshReady === true,
    publicBind: false,
    variationSummary: getSessionVariationSummary(sessionId),
    desktopReadiness: workstationReadiness,
    workstationCredentials: sanitizeWorkstationCredentialsForClient(provisioned.workstationCredentials)
  }

  registerSessionHostPorts(sessionId, portBundle.ports)
  sessions.set(sessionId, session)
  initSessionTelemetry(sessionId)
  if (!desktopTiming.awaitingDesktopEnter) {
    initSessionObjectives(sessionId, lab)
  }
  clearDesktopRecoverySnapshot(sessionId)
  progress?.emit?.('ready', { status: 'success', message: 'Lab ready.' })
  maybeNotifyLabDeploymentReady(labId, lab, sessionId)

  return sanitizeSessionForClient(
    {
      sessionId,
      labId,
      containerName: helper.containerName,
      containerId: helperResult.containerId,
      status: session.status,
      runtime: session.runtime,
      labMode: session.labMode,
      ports: session.ports,
      serviceRoutes: session.serviceRoutes,
      connection: session.connection,
      connectionRoutes: session.connectionRoutes,
      credentials: session.credentials,
      workstationCredentials: session.workstationCredentials,
      helper: session.helper,
      sshReady: session.sshReady,
      startedAt: session.startedAt,
      activated: session.activated,
      awaitingDesktopEnter: session.awaitingDesktopEnter === true,
      desktopReadiness: session.desktopReadiness,
      image,
      publicBind: false,
      message: desktopTiming.awaitingDesktopEnter
        ? 'Desktop setup complete. Click Start lab in the app to begin.'
        : 'Lab active. Complete lab objectives, then check / validate.',
      resumed: true
    },
    lab
  )
}

/**
 * Tear down in-progress desktop setup sessions (recovery snapshots) on app quit.
 * Without this, ephemeral containers are kept for resume and survive closing the app.
 */
export async function shutdownIncompleteLabStartupForAppQuit() {
  const recoveryIds = listDesktopRecoverySessionIds()
  let cleaned = 0

  for (const sessionId of recoveryIds) {
    try {
      cancelMissionStartup(sessionId)
      const snapshot = loadDesktopRecoverySnapshot(sessionId)
      await abortMissionStartup(sessionId, snapshot?.labId ?? 'unknown', {
        sessionId,
        sessionDockerRuntime: snapshot?.dockerRuntime ?? null,
        desktopDockerRuntime: snapshot?.dockerRuntime ?? null,
        helperContainerId: snapshot?.helperContainerId ?? null,
        targetContainerId: snapshot?.targetContainerId ?? null,
        helperContainerName: snapshot?.containerName ?? null,
        networkName: snapshot?.networkName ?? null
      }, { force: true })

      const wslRuntime = toDockerManagerRuntime(snapshot?.dockerRuntime)
      if (wslRuntime === DOCKER_RUNTIME_WSL_KVM) {
        await cleanupSessionResources(sessionId, {
          labId: snapshot?.labId,
          dockerRuntime: DOCKER_RUNTIME_WSL_KVM,
          force: true,
          removeEphemeralImages: false,
          removePersistentImages: false,
          clearSessionState: false
        })
      }
      cleaned += 1
    } catch (error) {
      logger.warn('labManager', 'Incomplete lab startup cleanup on quit failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  if (cleaned > 0) {
    logger.info('labManager', 'Cleaned incomplete lab startups on app quit', { cleaned })
  }

  return { cleaned }
}

/**
 * End all active lab sessions before app quit (triggers VM session_end cleanup).
 */
export async function shutdownAllActiveLabSessionsForAppQuit() {
  const sessionIds = [...sessions.keys()]
  for (const sessionId of sessionIds) {
    try {
      const session = sessions.get(sessionId)
      if (!session) continue
      await teardownLabSession(session)
      sessions.delete(sessionId)
    } catch (error) {
      logger.warn('labManager', 'Session teardown on app quit failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  return { stopped: sessionIds.length }
}

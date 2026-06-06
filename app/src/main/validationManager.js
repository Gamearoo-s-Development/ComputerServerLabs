/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { app } from 'electron'
import net from 'net'
import * as dockerManager from './dockerManager.js'
import {
  completeLab,
  getLabProgress,
  incrementValidationPasses,
  previewLabXp
} from './progressManager.js'
import { evaluateSessionObjectives } from './autoProgressManager.js'
import { buildPostLabReview } from './labIncident.js'
import { recordValidationAttempt, recordHintOpened } from './labSessionTelemetry.js'
import { mergeObjectiveRowsForDisplay } from './labObjectives.js'
import { formatLearnerValidationMessage } from './labObjectives.js'
import { completeAndTeardownLab, resolveLabFromSession, getSessionState } from './labManager.js'
import { sessionDockerExecOptionsFromSession } from './sessionDockerRuntime.js'
import { getAllSettings } from './settingsManager.js'
import { getOnlineStatus } from './online/onlineApiClient.js'
import { syncProgressToCloud } from './online/onlineProgressSync.js'
import { notifyLabCompletedEmail } from './online/onlineNotificationManager.js'
import { logger } from './utils/logger.js'
import {
  assertSafeSessionId,
  assertValidationAllowed,
  CONTAINER_VALIDATION_TYPES,
  getSafetyModeConfig,
  matchTextAnswer,
  sanitizeContainerHttpUrl,
  sanitizeContainerPath,
  sanitizeExecArgv,
  sanitizePackageName,
  sanitizePermissionMode,
  sanitizePort,
  sanitizeServiceName,
  sanitizeUnixUser
} from './utils/sanitize.js'

const VALIDATION_TIMEOUT_MS = 30_000

/**
 * @param {object} session
 * @param {number} [timeoutMs]
 */
function dockerExecOptionsForSession(session, timeoutMs = VALIDATION_TIMEOUT_MS) {
  return { timeout: timeoutMs, ...sessionDockerExecOptionsFromSession(session) }
}

function isDevRuntime() {
  return !app.isPackaged || Boolean(process.env.ELECTRON_RENDERER_URL)
}

function canUseDevMock() {
  if (!isDevRuntime()) return false
  return getAllSettings().mockValidationModeDevOnly === true
}

/**
 * @param {{ sessionId: string, labId: string, type: string, passed: boolean, durationMs: number, mock?: boolean, message?: string }} entry
 */
function logValidationResult(entry) {
  logger.info('validation', 'Validation completed', {
    sessionId: entry.sessionId,
    labId: entry.labId,
    type: entry.type,
    passed: entry.passed,
    durationMs: entry.durationMs,
    mock: entry.mock ?? false,
    message: entry.message
  })
}

/**
 * @param {object} session
 * @param {number} containerPort
 */
function resolveHostPort(session, containerPort) {
  const mapping = session.ports?.find((p) => p.container === containerPort)
  if (!mapping?.host) {
    throw new Error(`No host mapping for container port ${containerPort}`)
  }
  return mapping.host
}

/**
 * @param {number} port
 * @param {string} host
 */
function tcpConnect(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const timer = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, timeoutMs)

    socket.on('connect', () => {
      clearTimeout(timer)
      socket.end()
      resolve(true)
    })
    socket.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
  })
}

/**
 * @param {object} session
 * @param {object} validation
 */
async function validateFileExists(session, validation) {
  const containerId = session?.helper?.targetContainerId ?? session.containerId
  const pathValue = sanitizeContainerPath(validation.path)
  const result = await dockerManager.exec(
    containerId,
    ['test', '-f', pathValue],
    { timeout: VALIDATION_TIMEOUT_MS, ...sessionDockerExecOptionsFromSession(session) }
  )
  return {
    passed: result.ok,
    message: result.ok
      ? `File exists: ${pathValue}`
      : `File not found: ${pathValue}. Finish all lab objectives first — completion is applied automatically.`
  }
}

/**
 * @param {object} session
 * @param {object} validation
 */
async function validateCommand(session, validation) {
  const containerId = session?.helper?.targetContainerId ?? session.containerId
  const argv = sanitizeExecArgv(validation.command)
  const result = await dockerManager.exec(containerId, argv, dockerExecOptionsForSession(session))
  return {
    passed: result.ok,
    message: result.ok ? 'Command succeeded' : result.stderr || result.stdout || 'Command failed'
  }
}

/**
 * @param {object} session
 * @param {object} validation
 */
async function validateServiceRunning(session, validation) {
  const containerId = session?.helper?.targetContainerId ?? session.containerId
  const service = sanitizeServiceName(validation.service)
  const result = await dockerManager.exec(
    containerId,
    ['systemctl', 'is-active', service],
    dockerExecOptionsForSession(session)
  )
  const active = result.stdout.trim() === 'active'
  return {
    passed: result.ok && active,
    message: active ? `Service ${service} is active` : `Service ${service} is not active`
  }
}

/**
 * @param {object} session
 * @param {object} validation
 */
async function validateHttpResponse(session, validation) {
  const containerId = session?.helper?.targetContainerId ?? session.containerId
  const url = sanitizeContainerHttpUrl(validation.url ?? 'http://127.0.0.1/')
  const expected = validation.expectedStatus ?? 200
  const result = await dockerManager.exec(
    containerId,
    ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', url],
    dockerExecOptionsForSession(session)
  )
  const status = Number.parseInt(result.stdout.trim(), 10)
  const passed = result.ok && status === expected
  return {
    passed,
    message: passed ? `HTTP ${status} from ${url}` : `Expected HTTP ${expected}, got ${status || 'no response'}`
  }
}

/**
 * @param {object} session
 * @param {object} validation
 */
async function validatePortOpen(session, validation) {
  const containerPort = sanitizePort(validation.port ?? session.ports?.[0]?.container ?? 22)
  const hostPort = resolveHostPort(session, containerPort)
  const open = await tcpConnect('127.0.0.1', hostPort)
  return {
    passed: open,
    message: open ? `Port 127.0.0.1:${hostPort} is open` : `Port 127.0.0.1:${hostPort} is closed`
  }
}

/**
 * @param {object} session
 * @param {object} validation
 */
async function validateUserExists(session, validation) {
  const containerId = session?.helper?.targetContainerId ?? session.containerId
  const user = sanitizeUnixUser(validation.user)
  const result = await dockerManager.exec(
    containerId,
    ['id', '-u', user],
    dockerExecOptionsForSession(session)
  )
  return {
    passed: result.ok,
    message: result.ok ? `User ${user} exists` : `User ${user} not found`
  }
}

/**
 * @param {object} session
 * @param {object} validation
 */
async function validatePermission(session, validation) {
  const containerId = session?.helper?.targetContainerId ?? session.containerId
  const pathValue = sanitizeContainerPath(validation.path)
  const expectedMode = sanitizePermissionMode(validation.mode)
  const result = await dockerManager.exec(
    containerId,
    ['stat', '-c', '%a', pathValue],
    dockerExecOptionsForSession(session)
  )
  const actual = result.stdout.trim()
  const passed = result.ok && actual === expectedMode
  return {
    passed,
    message: passed ? `Mode ${actual} matches` : `Expected mode ${expectedMode}, got ${actual || 'unknown'}`
  }
}

/**
 * @param {object} session
 * @param {object} validation
 */
async function validatePackageInstalled(session, validation) {
  const containerId = session?.helper?.targetContainerId ?? session.containerId
  const pkg = sanitizePackageName(validation.package)
  const execOpts = dockerExecOptionsForSession(session)
  const dpkg = await dockerManager.exec(containerId, ['dpkg', '-s', pkg], execOpts)
  if (dpkg.ok) {
    return { passed: true, message: `Package ${pkg} installed (dpkg)` }
  }
  const rpm = await dockerManager.exec(containerId, ['rpm', '-q', pkg], execOpts)
  return {
    passed: rpm.ok,
    message: rpm.ok ? `Package ${pkg} installed (rpm)` : `Package ${pkg} not installed`
  }
}

/**
 * @param {object} validation
 * @param {object} payload
 */
function validateTextAnswer(validation, payload) {
  const answer = String(payload?.answer ?? '').trim()
  if (!answer) {
    return { passed: false, message: 'Enter an answer before validating.' }
  }

  const config = validation.answerConfig ?? {}
  if (config.useRegex === true && Array.isArray(validation.acceptedAnswers)) {
    for (const pattern of validation.acceptedAnswers) {
      try {
        const flags = config.caseSensitive ? '' : 'i'
        const re = new RegExp(pattern, flags)
        if (re.test(answer)) {
          return { passed: true, message: 'Answer accepted' }
        }
      } catch {
        // skip invalid pattern
      }
    }
    return {
      passed: false,
      message: 'Answer should include a Docker version number (for example 27.4).'
    }
  }

  const passed = matchTextAnswer(answer, validation.acceptedAnswers)
  return {
    passed,
    message: passed ? 'Answer accepted' : 'Answer does not match expected values'
  }
}

/**
 * @param {object} session
 * @param {object} validation
 * @param {object} payload
 */
async function runContainerValidation(session, validation, payload) {
  switch (validation.type) {
    case 'fileExists':
      return validateFileExists(session, validation)
    case 'command':
      return validateCommand(session, validation)
    case 'serviceRunning':
      return validateServiceRunning(session, validation)
    case 'httpResponse':
      return validateHttpResponse(session, validation)
    case 'portOpen':
      return validatePortOpen(session, validation)
    case 'userExists':
      return validateUserExists(session, validation)
    case 'permission':
      return validatePermission(session, validation)
    case 'packageInstalled':
      return validatePackageInstalled(session, validation)
    case 'textAnswer':
      return validateTextAnswer(validation, payload)
    default:
      throw new Error(`Unsupported validation type: ${validation.type}`)
  }
}

/**
 * Dev-only mock when Docker unavailable (set SYSADMIN_GAME_MOCK_VALIDATION=1).
 * @param {object} validation
 */
function runDevMockValidation(validation) {
  return {
    passed: true,
    message: `Dev mock passed for ${validation.type}`,
    mock: true
  }
}

/**
 * @param {string} sessionId
 * @param {{ answer?: string, hintsUsed?: number }} [payload]
 */
export async function validateLabSession(sessionId, payload = {}) {
  const startedAt = Date.now()
  assertSafeSessionId(sessionId)

  const session = getSessionState(sessionId)
  if (session.status !== 'running') {
    throw new Error('Lab session is not running')
  }

  const lab = resolveLabFromSession(session)
  const validation = lab.validation
  assertValidationAllowed(validation, getSafetyModeConfig())

  const hintsUsed = Math.max(0, Number(payload.hintsUsed ?? 0) || 0)
  const settings = getAllSettings()
  const showDebug = settings.developerMode === true && settings.showLabDebugInfo === true
  let outcome

  const dockerReady = (await dockerManager.checkReady()).ready

  if (!dockerReady && canUseDevMock()) {
    outcome = runDevMockValidation(validation)
  } else if (!dockerReady && validation.type !== 'textAnswer') {
    throw new Error('Docker is not available for validation')
  } else if (validation.type === 'textAnswer') {
    outcome = validateTextAnswer(validation, payload)
  } else if (validation.type === 'portOpen') {
    outcome = await validatePortOpen(session, validation)
  } else if (CONTAINER_VALIDATION_TYPES.has(validation.type)) {
    if (
      validation.type === 'fileExists' &&
      validation.path === '/tmp/lab-complete' &&
      Array.isArray(lab.objectives) &&
      lab.objectives.length > 0
    ) {
      await evaluateSessionObjectives(sessionId, lab.objectives)
    }
    outcome = await runContainerValidation(session, validation, payload)
  } else {
    throw new Error(`Unsupported validation type: ${validation.type}`)
  }

  const durationMs = Date.now() - startedAt
  const xpPreview = previewLabXp(lab.xpReward, hintsUsed)

  recordValidationAttempt(sessionId, outcome.passed)

  logValidationResult({
    sessionId,
    labId: session.labId,
    type: validation.type,
    passed: outcome.passed,
    durationMs,
    mock: outcome.mock,
    message: outcome.message
  })

  const learnerMessage = formatLearnerValidationMessage(validation, outcome, showDebug)

  /** @type {object} */
  const response = {
    passed: outcome.passed,
    type: validation.type,
    message: learnerMessage,
    debugMessage: showDebug ? outcome.message : undefined,
    durationMs,
    mock: outcome.mock ?? false,
    hintsUsed,
    xpPreview,
    xpAwarded: null,
    totalXp: null,
    level: null,
    labId: session.labId
  }

  if (outcome.passed && !outcome.mock) {
    // Gate completion on objectives (when present). A lab is only “complete” when validation passes
    // AND required objectives have proof.
    try {
      const objectiveResult = await evaluateSessionObjectives(sessionId, lab.objectives ?? [])
      const mergedObjectives = mergeObjectiveRowsForDisplay(lab, objectiveResult.objectives)
      response.objectives = mergedObjectives
      response.allObjectivesComplete =
        mergedObjectives.length > 0 && mergedObjectives.every((entry) => entry.completed)
    } catch {
      response.allObjectivesComplete = null
    }

    if (Array.isArray(response.objectives) && response.objectives.length > 0 && response.allObjectivesComplete === false) {
      response.passed = false
      response.xpAwarded = 0
      response.message =
        'Lab check passed, but lab objectives are not complete yet. Finish all required objectives, then check/validate again.'
      return response
    }

    if (session.builderTest) {
      try {
        await completeAndTeardownLab(sessionId)
        response.environmentRemoved = true
      } catch (error) {
        logger.warn('validation', 'Builder test teardown failed', {
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
      response.builderTest = true
      response.xpAwarded = 0
      response.message = `${outcome.message} Builder test passed — no XP or progress saved. Temporary lab removed.`
      return response
    }

    const priorProgress = getLabProgress(session.labId)
    const firstCompletion = !priorProgress || priorProgress.completed !== 1

    if (firstCompletion) {
      incrementValidationPasses()
    }

    const startedMs = Date.parse(session.startedAt)
    const durationSec = Number.isFinite(startedMs) ? Math.round((Date.now() - startedMs) / 1000) : null
    const award = completeLab(session.labId, lab.xpReward, hintsUsed, durationSec)
    response.xpAwarded = award.xpAwarded
    response.totalXp = award.totalXp
    response.level = award.level
    response.levelIncreased = award.levelIncreased === true
    response.newlyUnlockedLabs = award.newlyUnlockedLabs ?? []
    response.labId = session.labId
    response.alreadyCompleted = award.alreadyCompleted === true
    response.postLabReview = buildPostLabReview(lab, sessionId, {
      xpAwarded: award.xpAwarded,
      durationSec
    })

    if (getOnlineStatus().linked && getAllSettings().cloudSyncEnabled !== false) {
      void syncProgressToCloud().catch((error) => {
        logger.warn('validation', 'Post-completion cloud sync failed', {
          sessionId,
          labId: session.labId,
          error: error instanceof Error ? error.message : String(error)
        })
      })
    }

    if (firstCompletion && getOnlineStatus().linked) {
      void notifyLabCompletedEmail({
        labId: session.labId,
        labTitle: lab.title ?? lab.name ?? session.labId,
        xpEarned: award.xpAwarded,
        bestTimeSec: durationSec,
        hintsUsed
      }).catch((error) => {
        logger.warn('validation', 'Lab completion email failed', {
          sessionId,
          labId: session.labId,
          error: error instanceof Error ? error.message : String(error)
        })
      })
    }

    if (session.status === 'running') {
      try {
        const objectiveResult = await evaluateSessionObjectives(sessionId, lab.objectives ?? [])
        const mergedObjectives = mergeObjectiveRowsForDisplay(lab, objectiveResult.objectives)
        response.objectives = mergedObjectives
        response.allObjectivesComplete =
          mergedObjectives.length > 0 && mergedObjectives.every((entry) => entry.completed)
      } catch {
        // non-fatal before teardown
      }
    }

    try {
      const teardown = await completeAndTeardownLab(sessionId)
      response.environmentRemoved = true
      response.message = teardown.message
      if (award.alreadyCompleted) {
        response.message = `${outcome.message} Lab already completed — no additional XP. Temporary lab environment removed.`
      }
    } catch (error) {
      logger.warn('validation', 'Lab completed but environment teardown failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      })
      response.message = award.alreadyCompleted
        ? `${outcome.message} (lab already completed — no additional XP)`
        : 'Lab complete. Player progress saved.'
    }
  } else if (session.status === 'running') {
    try {
      const objectiveResult = await evaluateSessionObjectives(sessionId, lab.objectives ?? [])
      const mergedObjectives = mergeObjectiveRowsForDisplay(lab, objectiveResult.objectives)
      response.objectives = mergedObjectives
      response.allObjectivesComplete =
        mergedObjectives.length > 0 && mergedObjectives.every((entry) => entry.completed)
    } catch {
      // objective polling remains available via labs:getObjectives
    }
  }

  return response
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import net from 'net'
import * as dockerManager from './dockerManager.js'
import { getSessionState } from './labManager.js'
import { sessionDockerExecOptionsFromSession } from './sessionDockerRuntime.js'
import { evaluateObjectiveAnswer } from './objectiveAnswers.js'
import { shouldSkipAutoCheckForSecurityObjective } from './securitySimulationLab.js'
import { assertSafeSessionId } from './utils/sanitize.js'
import {
  sanitizeContainerPath,
  sanitizeExecArgv,
  sanitizePackageName,
  sanitizePermissionMode,
  sanitizePort,
  sanitizeServiceName,
  sanitizeUnixUser
} from './utils/sanitize.js'

/** @type {Map<string, Map<string, { completed: boolean, completedAt?: string, answered?: boolean, answeredAt?: string, detected?: boolean, detectedAt?: string, incorrectAttempts?: number, lastFeedback?: string }>>} */
const sessionObjectiveState = new Map()

export const LAB_COMPLETION_MARKER_PATH = '/tmp/lab-complete'

/**
 * @param {object | null | undefined} objective
 */
export function isLabCompletionMarkerObjective(objective) {
  if (!objective) return false
  if (objective.id === 'lab-complete') return true
  return (
    objective.autoCheck === 'fileExists' && objective.path === LAB_COMPLETION_MARKER_PATH
  )
}

/**
 * @param {object[]} objectiveList
 * @param {Map<string, object>} stateMap
 */
export function nonMarkerObjectivesComplete(objectiveList, stateMap) {
  const nonMarker = objectiveList.filter((o) => !isLabCompletionMarkerObjective(o))
  if (nonMarker.length === 0) return false
  return nonMarker.every((o) => stateMap.get(o.id)?.completed === true)
}

/**
 * @param {object} session
 */
async function ensureLabCompletionMarkerFile(session) {
  const targetContainerId = session?.helper?.targetContainerId ?? session.containerId
  const dockerOpts = { timeout: 10_000, ...sessionDockerExecOptionsFromSession(session) }
  await dockerManager
    .exec(targetContainerId, ['touch', LAB_COMPLETION_MARKER_PATH], dockerOpts)
    .catch(() => null)
}

/**
 * When every non-marker objective is done, mark lab-complete and create /tmp/lab-complete.
 * @param {object} session
 * @param {object[]} objectiveList
 * @param {Map<string, object>} stateMap
 */
async function applyAutoLabCompletion(session, objectiveList, stateMap) {
  const markerObjectives = objectiveList.filter(isLabCompletionMarkerObjective)
  if (markerObjectives.length === 0) return false
  if (!nonMarkerObjectivesComplete(objectiveList, stateMap)) return false

  let changed = false
  for (const objective of markerObjectives) {
    const prev = stateMap.get(objective.id) ?? { completed: false, answered: false, detected: false }
    if (!prev.completed) {
      stateMap.set(objective.id, {
        ...prev,
        completed: true,
        completedAt: new Date().toISOString(),
        detected: true,
        detectedAt: prev.detectedAt ?? new Date().toISOString()
      })
      changed = true
    }
  }

  await ensureLabCompletionMarkerFile(session)
  return changed
}

/**
 * @param {object} state
 */
function objectiveStatusFromState(state) {
  if (state.completed) return 'completed'
  if (state.answered) return 'answered'
  if ((state.incorrectAttempts ?? 0) > 0) return 'incorrect'
  if (state.detected) return 'detected'
  return 'pending'
}

/**
 * Submit an objective “answer” and update in-memory state.
 * This never touches disk; it is session-memory only until lab completion.
 *
 * @param {string} sessionId
 * @param {object} objective
 * @param {string} answer
 * @param {{ dynamicAnswers?: string[], answerConfig?: object, questionId?: string }} [options]
 */
export function submitObjectiveAnswer(sessionId, objective, answer, options = {}) {
  assertSafeSessionId(sessionId)
  if (!objective?.id) throw new Error('Objective id missing')
  if (typeof answer !== 'string') throw new Error('Answer must be a string')

  const trimmed = answer.trim()
  if (!trimmed) {
    return {
      correct: false,
      completed: false,
      message: 'Enter an answer before submitting.',
      status: 'pending'
    }
  }

  if (!sessionObjectiveState.has(sessionId)) {
    initSessionObjectives(sessionId, { objectives: [objective] })
  }
  const map = sessionObjectiveState.get(sessionId)
  const prev = map.get(objective.id) ?? { completed: false, incorrectAttempts: 0 }

  const accepted =
    Array.isArray(options.dynamicAnswers) && options.dynamicAnswers.length
      ? options.dynamicAnswers
      : (objective.acceptedAnswers ?? [])

  const evaluation = evaluateObjectiveAnswer(trimmed, accepted, options.answerConfig ?? objective.answerConfig)
  const correct = evaluation.correct

  const next = {
    ...prev,
    answered: correct ? true : prev.answered,
    answeredAt: correct ? new Date().toISOString() : prev.answeredAt,
    incorrectAttempts: correct ? prev.incorrectAttempts : (prev.incorrectAttempts ?? 0) + 1,
    lastFeedback: correct ? 'correct' : 'That answer is not correct yet. Try again.',
    completed: prev.completed || correct,
    completedAt: prev.completed || !correct ? prev.completedAt : new Date().toISOString()
  }
  map.set(objective.id, next)

  return {
    correct,
    completed: next.completed,
    message: correct ? 'Answer accepted.' : next.lastFeedback,
    status: objectiveStatusFromState(next),
    questionId: options.questionId ?? null
  }
}

/**
 * @param {object} session
 * @param {object} objective
 */
async function runAutoCheck(session, objective) {
  const check = objective.autoCheck ?? 'manual'
  if (check === 'manual') {
    return false
  }

  if (shouldSkipAutoCheckForSecurityObjective(objective)) {
    return false
  }

  const targetContainerId = session?.helper?.targetContainerId ?? session.containerId
  const dockerOpts = { timeout: 10_000, ...sessionDockerExecOptionsFromSession(session) }

  switch (check) {
    case 'fileExists': {
      const pathValue = sanitizeContainerPath(objective.path)
      const result = await dockerManager.exec(targetContainerId, ['test', '-f', pathValue], dockerOpts)
      return result.ok
    }
    case 'command': {
      const argv = sanitizeExecArgv(objective.command)
      const result = await dockerManager.exec(targetContainerId, argv, dockerOpts)
      return result.ok
    }
    case 'portOpen': {
      const containerPort = sanitizePort(objective.port ?? 22)
      const mapping = session.ports?.find((p) => p.container === containerPort)
      if (!mapping?.host) return false
      return new Promise((resolve) => {
        const socket = net.createConnection({ host: '127.0.0.1', port: mapping.host })
        const timer = setTimeout(() => {
          socket.destroy()
          resolve(false)
        }, 3000)
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
    case 'serviceRunning': {
      const service = sanitizeServiceName(objective.service)
      const result = await dockerManager.exec(
        targetContainerId,
        ['systemctl', 'is-active', service],
        dockerOpts
      )
      return result.ok && result.stdout.trim() === 'active'
    }
    case 'permission': {
      const pathValue = sanitizeContainerPath(objective.path)
      const expectedMode = sanitizePermissionMode(objective.mode)
      const result = await dockerManager.exec(
        targetContainerId,
        ['stat', '-c', '%a', pathValue],
        dockerOpts
      )
      return result.ok && result.stdout.trim() === expectedMode
    }
    case 'userExists': {
      const user = sanitizeUnixUser(objective.user)
      const result = await dockerManager.exec(targetContainerId, ['id', '-u', user], dockerOpts)
      return result.ok
    }
    case 'packageInstalled': {
      const pkg = sanitizePackageName(objective.package)
      const dpkg = await dockerManager.exec(targetContainerId, ['dpkg', '-s', pkg], dockerOpts)
      if (dpkg.ok) return true
      const rpm = await dockerManager.exec(targetContainerId, ['rpm', '-q', pkg], dockerOpts)
      return rpm.ok
    }
    default:
      return false
  }
}

/**
 * @param {string} sessionId
 * @param {{ objectives?: object[] }} labLike
 */
export function initSessionObjectives(sessionId, labLike) {
  assertSafeSessionId(sessionId)
  const map = new Map()
  for (const objective of labLike.objectives ?? []) {
    map.set(objective.id, { completed: false, answered: false, detected: false })
  }
  sessionObjectiveState.set(sessionId, map)
}

/**
 * @param {string} sessionId
 */
export function clearSessionObjectives(sessionId) {
  sessionObjectiveState.delete(sessionId)
}

/**
 * @param {string} sessionId
 * @param {object[]} [objectives]
 */
export async function evaluateSessionObjectives(sessionId, objectives = []) {
  assertSafeSessionId(sessionId)
  const session = getSessionState(sessionId)
  if (session.status !== 'running') {
    throw new Error('Lab session is not running')
  }

  const objectiveList = objectives.length ? objectives : session.objectives ?? []
  if (!sessionObjectiveState.has(sessionId)) {
    initSessionObjectives(sessionId, { objectives: objectiveList })
  }
  const stateMap = sessionObjectiveState.get(sessionId)

  /** @type {object[]} */
  const results = []
  let changed = false

  for (const objective of objectiveList) {
    const prev = stateMap.get(objective.id) ?? { completed: false, answered: false, detected: false }
    let completed = prev.completed

    if (!completed && objective.autoCheck && objective.autoCheck !== 'manual') {
      try {
        completed = await runAutoCheck(session, objective)
      } catch {
        completed = false
      }
    }

    if (completed && !prev.completed) {
      changed = true
      stateMap.set(objective.id, {
        ...prev,
        detected: true,
        detectedAt: prev.detectedAt ?? new Date().toISOString(),
        completed: true,
        completedAt: new Date().toISOString()
      })
    } else {
      stateMap.set(objective.id, { ...prev, completed })
    }

    const cur = stateMap.get(objective.id) ?? prev
    const status = objectiveStatusFromState(cur)

    const requiresAnswer =
      objective.autoCheck === 'manual' &&
      (Boolean(objective.answerKey) ||
        (Array.isArray(objective.acceptedAnswers) && objective.acceptedAnswers.length > 0))

    results.push({
      id: objective.id,
      label: objective.label,
      completed: cur.completed ?? false,
      autoCheck: objective.autoCheck ?? 'manual',
      completedAt: cur.completedAt ?? null,
      answered: cur.answered ?? false,
      detected: cur.detected ?? false,
      incorrectAttempts: cur.incorrectAttempts ?? 0,
      lastFeedback: cur.lastFeedback ?? null,
      requiresAnswer,
      status
    })
  }

  const autoCompleted = await applyAutoLabCompletion(session, objectiveList, stateMap)
  if (autoCompleted) {
    changed = true
    for (let i = 0; i < results.length; i += 1) {
      const objective = objectiveList[i]
      if (!isLabCompletionMarkerObjective(objective)) continue
      const cur = stateMap.get(objective.id)
      if (!cur) continue
      results[i] = {
        ...results[i],
        completed: true,
        completedAt: cur.completedAt ?? results[i].completedAt,
        detected: true,
        status: objectiveStatusFromState(cur)
      }
    }
  }

  return { objectives: results, changed }
}

/**
 * @param {string} sessionId
 * @param {string} objectiveId
 */
export function markObjectiveComplete(sessionId, objectiveId) {
  if (!sessionObjectiveState.has(sessionId)) return false
  const map = sessionObjectiveState.get(sessionId)
  map.set(objectiveId, { completed: true, completedAt: new Date().toISOString() })
  return true
}

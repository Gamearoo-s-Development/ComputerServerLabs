/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import path from 'path'
import { buildTemplateContext, renderTemplateString } from './labBuilder/labTemplateVariables.js'
import { getSessionVariation } from './sessionVariationManager.js'
import { getLabsPath } from './utils/paths.js'
import { resolvePathWithin } from './security/safeFiles.js'
import { summarizeCommands, getSessionTelemetry } from './labSessionTelemetry.js'
import { logger } from './utils/logger.js'

const ALLOWED_ATTACHMENT_EXT = new Set([
  '.txt',
  '.log',
  '.md',
  '.json',
  '.conf',
  '.cfg',
  '.ini',
  '.yaml',
  '.yml',
  '.csv',
  '.html',
  '.htm'
])

/**
 * @param {object} [lab]
 */
export function labHasIncidentBriefing(lab) {
  const ticket = lab?.ticket
  return Boolean(
    ticket &&
      typeof ticket === 'object' &&
      (ticket.id || ticket.summary || ticket.description || (ticket.history?.length ?? 0) > 0)
  )
}

/**
 * @param {object} [lab]
 */
export function normalizeObjectiveDisplayMode(lab) {
  const mode = lab?.objectiveDisplay ?? lab?.incident?.objectiveDisplay ?? 'visible'
  if (['visible', 'hidden', 'ticket-only', 'partial'].includes(mode)) return mode
  return 'visible'
}

/**
 * @param {object} lab
 * @param {object} [variation]
 * @param {string} [sessionId]
 */
export function buildIncidentTemplateContext(lab, variation, sessionId) {
  return buildTemplateContext({
    labId: lab.id,
    username: variation?.username ?? 'labuser',
    password: '(session)',
    sessionId: sessionId ?? variation?.sessionId ?? '',
    trainingFlag: variation?.trainingFlag,
    flagBasename: variation?.flagFile?.basename,
    flagPath: variation?.flagFile?.fullPath,
    randomSeed: variation?.seed ?? ''
  })
}

/**
 * @param {unknown} value
 * @param {object} ctx
 * @param {{ redactSecrets?: boolean }} [opts]
 */
function renderField(value, ctx, opts = {}) {
  if (typeof value !== 'string') return value
  return renderTemplateString(value, ctx, { redactSecrets: opts.redactSecrets !== false })
}

/**
 * @param {object} lab
 * @param {object} [variation]
 * @param {{ sessionId?: string, redactSecrets?: boolean, unlockPhase?: string }} [options]
 */
export function resolveIncidentBriefing(lab, variation, options = {}) {
  const ctx = buildIncidentTemplateContext(lab, variation, options.sessionId)
  const redact = options.redactSecrets !== false
  const ticket = lab.ticket ?? {}
  const incident = lab.incident ?? {}

  const priority = normalizePriority(ticket.priority ?? incident.severity ?? 'medium')
  const severity = normalizePriority(incident.severity ?? ticket.priority ?? 'medium')

  /** @type {object[]} */
  const history = (ticket.history ?? []).map((entry) => ({
    ...entry,
    time: entry.time ?? entry.at ?? null,
    author: renderField(entry.author ?? 'Unknown', ctx, { redactSecrets: redact }),
    message: renderField(entry.message ?? '', ctx, { redactSecrets: redact }),
    redHerring: entry.redHerring === true
  }))

  /** @type {object[]} */
  const timeline = (incident.timeline ?? []).map((entry) => ({
    ...entry,
    time: entry.time ?? entry.at ?? null,
    label: renderField(entry.label ?? entry.event ?? '', ctx, { redactSecrets: redact }),
    detail: renderField(entry.detail ?? entry.message ?? '', ctx, { redactSecrets: redact }),
    redHerring: entry.redHerring === true
  }))

  const combinedTimeline = mergeTimeline(history, timeline)
    .filter((e) => !e.redHerring || options.showRedHerrings === true)
    .sort((a, b) => String(a.time ?? '').localeCompare(String(b.time ?? '')))

  const attachments = resolveAttachmentManifest(lab, options.unlockPhase ?? 'start')

  const monitoringAlerts = (incident.monitoringAlerts ?? []).map((alert) => ({
    ...alert,
    title: renderField(alert.title ?? alert.name ?? 'Alert', ctx, { redactSecrets: redact }),
    message: renderField(alert.message ?? alert.body ?? '', ctx, { redactSecrets: redact }),
    severity: normalizePriority(alert.severity ?? 'medium'),
    redHerring: alert.redHerring === true
  }))

  return {
    ticket: {
      id: ticket.id ?? `INC-${lab.id}`,
      type: ticket.type ?? 'incident',
      priority,
      department: renderField(ticket.department ?? incident.department ?? 'IT Operations', ctx, {
        redactSecrets: redact
      }),
      requester: renderField(ticket.requester ?? 'Service Desk', ctx, { redactSecrets: redact }),
      summary: renderField(ticket.summary ?? lab.title ?? '', ctx, { redactSecrets: redact }),
      description: renderField(ticket.description ?? lab.description ?? '', ctx, { redactSecrets: redact }),
      createdAt: ticket.createdAt ?? null,
      escalationNotes: renderField(ticket.escalationNotes ?? '', ctx, { redactSecrets: redact }),
      history
    },
    incident: {
      severity,
      affectedServices: incident.affectedServices ?? [],
      outageBanner: incident.outageBanner === true || severity === 'critical',
      timerSeconds: incident.timerSeconds ?? null,
      company: incident.company ?? lab.immersion?.company ?? null,
      monitoringSystem: incident.monitoringSystem ?? lab.immersion?.monitoringSystem ?? 'CSL Monitor',
      timeline: combinedTimeline,
      monitoringAlerts: monitoringAlerts.filter((a) => !a.redHerring || options.showRedHerrings === true)
    },
    attachments,
    objectiveDisplay: normalizeObjectiveDisplayMode(lab),
    immersion: lab.immersion ?? null,
    postLabReview: lab.postLabReview ?? null,
    commandTrackingEnabled: lab.commandTracking?.enabled === true
  }
}

/**
 * @param {string} [value]
 */
function normalizePriority(value) {
  const v = String(value ?? 'medium').toLowerCase()
  if (v === 'critical' || v === 'high' || v === 'low') return v
  return 'medium'
}

/**
 * @param {object[]} history
 * @param {object[]} timeline
 */
function mergeTimeline(history, timeline) {
  const fromHistory = history.map((h) => ({
    time: h.time,
    label: h.author,
    detail: h.message,
    redHerring: h.redHerring === true,
    kind: 'comment'
  }))
  const fromTimeline = timeline.map((t) => ({
    time: t.time,
    label: t.label,
    detail: t.detail,
    redHerring: t.redHerring === true,
    kind: 'event'
  }))
  return [...fromHistory, ...fromTimeline]
}

/**
 * @param {object} lab
 * @param {string} [unlockPhase]
 */
export function resolveAttachmentManifest(lab, unlockPhase = 'start') {
  const defs = lab.attachments ?? []
  return defs
    .filter((a) => {
      if (a.visibleAtStart === false && unlockPhase === 'start') return false
      if (a.unlockPhase && a.unlockPhase !== unlockPhase) return false
      return true
    })
    .map((a) => ({
      id: a.id ?? a.filename,
      filename: a.filename,
      title: a.title ?? a.filename,
      type: a.type ?? 'note',
      description: a.description ?? null,
      redHerring: a.redHerring === true,
      visibleAtStart: a.visibleAtStart !== false
    }))
}

/**
 * @param {string} labId
 * @param {string} filename
 */
export function readLabAttachment(labId, filename) {
  const labsRoot = getLabsPath()
  const attachRoot = path.join(labsRoot, labId, 'attachments')
  const safeName = path.basename(filename)
  const full = resolvePathWithin(attachRoot, safeName)
  const ext = path.extname(safeName).toLowerCase()
  if (!ALLOWED_ATTACHMENT_EXT.has(ext)) {
    throw new Error('Attachment type is not allowed for in-app viewing.')
  }
  if (!fs.existsSync(full)) {
    throw new Error('Attachment not found.')
  }
  const stat = fs.statSync(full)
  if (stat.size > 256 * 1024) {
    throw new Error('Attachment is too large to display.')
  }
  const text = fs.readFileSync(full, 'utf8')
  return { filename: safeName, content: text, size: stat.size }
}

/**
 * @param {string} labId
 * @param {object} lab
 * @param {{ sessionId?: string }} [options]
 */
export function getIncidentBriefingForLab(labId, lab, options = {}) {
  const variation = options.sessionId ? getSessionVariation(options.sessionId) : null
  return resolveIncidentBriefing(lab, variation, {
    sessionId: options.sessionId,
    redactSecrets: true,
    unlockPhase: 'start'
  })
}

/**
 * @param {object} lab
 * @param {string} sessionId
 * @param {{ durationSec?: number, xpAwarded?: number }} [stats]
 */
export function buildPostLabReview(lab, sessionId, stats = {}) {
  const review = lab.postLabReview ?? {}
  const telemetry = getSessionTelemetry(sessionId)
  const commandSummary = telemetry ? summarizeCommands(telemetry.commands) : []

  const rootCause =
    review.rootCause ??
    review.likelyRootCause ??
    inferRootCauseFromLab(lab)

  const skills = review.skills ?? review.skillsPracticed ?? inferSkillsFromLab(lab)

  const summary =
    review.summary ??
    `You resolved ${lab.title ?? 'the incident'}.`

  const recommendedLabs = (review.recommendedLabs ?? []).map((id) => ({
    id,
    title: id
  }))

  return {
    resolved: true,
    incidentId: lab.ticket?.id ?? null,
    rootCause,
    skills,
    summary,
    commandsUsed: commandSummary,
    hintsOpened: telemetry?.hintsOpened ?? 0,
    validationAttempts: telemetry?.validationAttempts ?? 0,
    xpEarned: stats.xpAwarded ?? lab.xpReward ?? 0,
    durationSec: stats.durationSec ?? null,
    recommendedLabs,
    teachingNotes: review.teachingNotes ?? null
  }
}

/**
 * @param {object} lab
 */
function inferRootCauseFromLab(lab) {
  if (lab.validation?.type === 'serviceRunning' && lab.validation?.service) {
    return `The ${lab.validation.service} service needed to be restored.`
  }
  if (lab.category?.toLowerCase().includes('web') || lab.id?.includes('nginx')) {
    return 'A misconfiguration or failed service left the web stack unavailable.'
  }
  return 'Configuration or service state on the lab target did not match production expectations.'
}

/**
 * @param {object} lab
 */
function inferSkillsFromLab(lab) {
  const skills = new Set(['troubleshooting'])
  if (lab.category) skills.add(lab.category.toLowerCase())
  if (lab.docker?.services?.includes('nginx')) skills.add('nginx')
  if (lab.docker?.ports?.some((p) => (p.container ?? p.containerPort) === 22)) skills.add('ssh')
  return [...skills].slice(0, 6)
}

/**
 * @param {object} lab
 */
export function enrichLabCatalogWithIncident(lab, metadata) {
  return {
    ...metadata,
    hasTicket: labHasIncidentBriefing(lab),
    ticketId: lab.ticket?.id ?? null,
    incidentPriority: normalizePriority(lab.ticket?.priority ?? lab.incident?.severity ?? null),
    objectiveDisplay: normalizeObjectiveDisplayMode(lab)
  }
}

/**
 * @param {object} lab
 * @param {string} labDir
 */
export function scanLabAttachmentsFolder(labDir) {
  const attachDir = path.join(labDir, 'attachments')
  if (!fs.existsSync(attachDir)) return []
  try {
    return fs
      .readdirSync(attachDir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => ALLOWED_ATTACHMENT_EXT.has(path.extname(name).toLowerCase()))
  } catch (error) {
    logger.warn('labIncident', 'Could not scan attachments folder', {
      labDir,
      error: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

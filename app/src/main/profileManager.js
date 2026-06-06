/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import os from 'os'
import { ensureDataDirectories, getDataLayout } from './dataDirectoryManager.js'

const MAX_ACTIVITY = 40
const MAX_NOTIFICATIONS = 20

const DEFAULT_LAB_PROFILE = {
  displayName: '',
  setupCompleted: false,
  experienceLevel: 'beginner',
  createdAt: null,
  updatedAt: null
}

/** @type {typeof DEFAULT_LAB_PROFILE | null} */
let labProfileCache = null

/** @type {{ activity: object[], pendingNotifications?: object[], systemScanned?: boolean } | null} */
let activityCache = null

function nowIso() {
  return new Date().toISOString()
}

function loadLabProfileFromDisk() {
  ensureDataDirectories()
  const file = getDataLayout().labProfile
  if (!fs.existsSync(file)) {
    return {
      ...DEFAULT_LAB_PROFILE,
      displayName: os.userInfo().username || 'Player',
      createdAt: nowIso()
    }
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return { ...DEFAULT_LAB_PROFILE, ...raw }
  } catch {
    return {
      ...DEFAULT_LAB_PROFILE,
      displayName: os.userInfo().username || 'Player',
      createdAt: nowIso()
    }
  }
}

function persistLabProfile(profile) {
  ensureDataDirectories()
  profile.updatedAt = nowIso()
  fs.writeFileSync(getDataLayout().labProfile, JSON.stringify(profile, null, 2), 'utf8')
  labProfileCache = profile
  return profile
}

export function getLabProfile() {
  if (!labProfileCache) {
    labProfileCache = loadLabProfileFromDisk()
  }
  return labProfileCache
}

/**
 * @param {{ displayName?: string, experienceLevel?: string, setupCompleted?: boolean }} partial
 */
export function saveLabProfile(partial) {
  const current = getLabProfile()
  const next = {
    ...current,
    ...partial,
    displayName: String(partial.displayName ?? current.displayName ?? '').trim() || current.displayName,
    setupCompleted: partial.setupCompleted ?? current.setupCompleted
  }
  return persistLabProfile(next)
}

export function isLabProfileSetupComplete() {
  const profile = getLabProfile()
  return profile.setupCompleted === true && Boolean(profile.displayName?.trim())
}

function loadActivityStore() {
  ensureDataDirectories()
  const file = getDataLayout().activity
  if (!fs.existsSync(file)) {
    return { activity: [], pendingNotifications: [], systemScanned: false }
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return {
      activity: raw.activity ?? [],
      pendingNotifications: raw.pendingNotifications ?? [],
      systemScanned: raw.systemScanned ?? false
    }
  } catch {
    return { activity: [], pendingNotifications: [], systemScanned: false }
  }
}

function saveActivityStore(store) {
  ensureDataDirectories()
  fs.writeFileSync(getDataLayout().activity, JSON.stringify(store, null, 2), 'utf8')
  activityCache = store
}

function getActivityStore() {
  if (!activityCache) {
    activityCache = loadActivityStore()
  }
  return activityCache
}

/** Legacy profile shape for IPC merge */
export function getProfile() {
  const labProfile = getLabProfile()
  const store = getActivityStore()
  return {
    username: labProfile.displayName,
    displayName: labProfile.displayName,
    labProfile,
    xp: 0,
    level: 1,
    streak: 0,
    lastLabId: null,
    activity: store.activity,
    pendingNotifications: store.pendingNotifications,
    systemScanned: store.systemScanned
  }
}

/**
 * @param {{ type: string, message: string, tone?: 'info' | 'success' | 'warning' | 'danger' }} entry
 */
export function pushActivity(entry) {
  const store = getActivityStore()
  const item = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: entry.type,
    message: entry.message,
    tone: entry.tone ?? 'info',
    at: nowIso()
  }
  store.activity = [item, ...store.activity].slice(0, MAX_ACTIVITY)
  saveActivityStore(store)
  return item
}

/**
 * @param {{ title: string, body?: string, tone?: 'info' | 'success' | 'warning' | 'danger' }} payload
 */
export function pushNotification(payload) {
  const store = getActivityStore()
  const note = {
    id: `note-${Date.now()}`,
    title: payload.title,
    body: payload.body ?? '',
    tone: payload.tone ?? 'info',
    at: nowIso()
  }
  store.pendingNotifications = [note, ...(store.pendingNotifications ?? [])].slice(0, MAX_NOTIFICATIONS)
  saveActivityStore(store)
  return note
}

export function consumeNotifications() {
  const store = getActivityStore()
  const pending = store.pendingNotifications ?? []
  store.pendingNotifications = []
  saveActivityStore(store)
  return pending
}

/**
 * @param {import('./systemStatus.js').collectSystemStatus extends () => Promise<infer S> ? S : never} status
 */
export function recordSystemScanActivity(status) {
  const store = getActivityStore()
  if (store.systemScanned) {
    return getProfile()
  }

  const existingTypes = new Set(store.activity.map((a) => a.type))

  if (status.docker.status === 'installed' && !existingTypes.has('docker-running')) {
    pushActivity({ type: 'docker', message: 'Docker detected and daemon is running', tone: 'success' })
    pushNotification({ title: 'Docker Online', body: 'Container labs can run when lab packs are installed.', tone: 'success' })
  } else if (status.docker.status === 'missing' && !existingTypes.has('docker-missing')) {
    pushActivity({ type: 'docker', message: 'Docker not installed — install Docker to unlock container labs', tone: 'warning' })
  } else if (status.docker.status === 'needs_setup' && !existingTypes.has('docker-stopped')) {
    pushActivity({ type: 'docker', message: 'Docker installed but daemon is not running', tone: 'warning' })
  }

  if (status.labs.count > 0 && !existingTypes.has('labs-found')) {
    pushActivity({
      type: 'lab',
      message: `${status.labs.count} lab definition${status.labs.count === 1 ? '' : 's'} installed`,
      tone: 'success'
    })
  }

  store.systemScanned = true
  saveActivityStore(store)
  return getProfile()
}

export function getRankForLevel(level, ranks) {
  const sorted = [...ranks].sort((a, b) => b.minLevel - a.minLevel)
  const match = sorted.find((r) => level >= r.minLevel)
  return match ?? ranks[0]
}

export function clearActivityStore() {
  activityCache = null
  labProfileCache = null
}


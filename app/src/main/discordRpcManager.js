/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import { APP_NAME } from '@sysadmin-game/shared/branding/appBrand.js'
import { sanitizeDiscordPresencePayload } from './security/rpcSanitize.js'
import { getConfigPath } from './utils/paths.js'
import { logger } from './utils/logger.js'

/** @typedef {'disconnected' | 'unavailable' | 'connected' | 'disabled'} DiscordRpcState */

let enabled = true
/** @type {DiscordRpcState} */
let state = 'disconnected'
/** @type {import('discord-rpc').Client | null} */
let client = null
let connectPromise = null
let reconnectTimer = null
let applicationId = '1505990175530942535'

/** @type {{ details: string, state: string, largeImageKey?: string }} */
let pendingActivity = {
  details: 'Exploring Lab Browser',
  state: APP_NAME
}

function loadApplicationId() {
  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath('app.defaults.json'), 'utf8'))
    applicationId = config.discord?.applicationId ?? applicationId
  } catch {
    // keep default
  }
}

function scheduleReconnect() {
  if (reconnectTimer || !enabled) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void connectClient()
  }, 15000)
}

async function connectClient() {
  if (!enabled) {
    state = 'disabled'
    return null
  }

  if (client && state === 'connected') return client
  if (connectPromise) return connectPromise

  connectPromise = (async () => {
    try {
      const { Client } = await import('discord-rpc')
      const rpc = new Client({ transport: 'ipc' })
      rpc.on('error', (error) => {
        logger.warn('discord', 'RPC client error', { message: error?.message ?? String(error) })
        state = 'disconnected'
        scheduleReconnect()
      })

      await rpc.login({ clientId: applicationId })
      client = rpc
      state = 'connected'
      await applyActivity(pendingActivity)
      logger.info('discord', 'RPC connected')
      return rpc
    } catch (error) {
      client = null
      state = 'unavailable'
      logger.warn('discord', 'RPC unavailable', {
        message: error instanceof Error ? error.message : String(error)
      })
      scheduleReconnect()
      return null
    } finally {
      connectPromise = null
    }
  })()

  return connectPromise
}

async function applyActivity(activity) {
  pendingActivity = { ...pendingActivity, ...activity }
  if (!enabled || !client || state !== 'connected') return

  try {
    await client.setActivity({
      details: pendingActivity.details.slice(0, 128),
      state: pendingActivity.state.slice(0, 128),
      startTimestamp: Date.now(),
      largeImageKey: pendingActivity.largeImageKey ?? 'sysadmin',
      largeImageText: APP_NAME
    })
  } catch (error) {
    logger.warn('discord', 'Failed to set activity', {
      message: error instanceof Error ? error.message : String(error)
    })
    state = 'disconnected'
    scheduleReconnect()
  }
}

/**
 * Map mission titles / pages to game-flavored Rich Presence (details + state).
 * @param {{ page?: string, labTitle?: string, completedLab?: string, context?: string }} payload
 */
export function resolveDiscordPresence(payload = {}) {
  const safe = sanitizeDiscordPresencePayload(payload)
  const title = String(safe.labTitle ?? safe.completedLab ?? '').toLowerCase()

  if (safe.completedLab) {
    return {
      details: `Completed Lab: ${safe.completedLab}`.slice(0, 128),
      state: 'XP gained · ranking up'
    }
  }

  if (safe.context === 'terminal') {
    return { details: 'In Lab Terminal', state: 'SSH into the lab target' }
  }

  if (safe.context === 'intel') {
    return { details: 'Reviewing Hints', state: 'Lab in progress' }
  }

  if (safe.context === 'builder') {
    return { details: 'Building a Custom Lab', state: 'Lab Builder (dev)' }
  }

  if (safe.labTitle) {
    if (title.includes('nginx')) {
      return { details: 'Investigating Broken NGINX', state: `Running: ${safe.labTitle}`.slice(0, 128) }
    }
    if (title.includes('service') || title.includes('repair')) {
      return { details: 'Fixing a Failed Service', state: `Running: ${safe.labTitle}`.slice(0, 128) }
    }
    if (title.includes('disk') || title.includes('cleanup')) {
      return { details: 'Disk Cleanup Op', state: `Running: ${safe.labTitle}`.slice(0, 128) }
    }
    if (title.includes('permission')) {
      return { details: 'Permission Lockdown', state: `Running: ${safe.labTitle}`.slice(0, 128) }
    }
    if (title.includes('linux') || title.includes('beginner')) {
      return { details: 'First Contact Lab', state: `Running: ${safe.labTitle}`.slice(0, 128) }
    }
    return { details: 'Running Lab', state: safe.labTitle.slice(0, 128) }
  }

  switch (safe.page) {
    case 'progress':
      return { details: 'Player Progress', state: 'Tracking XP and ranks' }
    case 'achievements':
      return { details: 'Achievement Vault', state: 'Collecting badges' }
    case 'settings':
      return { details: 'Player Settings', state: APP_NAME }
    case 'command-guide':
      return { details: 'Command Guide', state: 'Studying the toolkit' }
    case 'tools':
      return { details: 'Health Checks', state: 'Checking Docker and tools' }
    case 'dashboard':
      return { details: 'Lab Dashboard', state: 'Planning the next run' }
    case 'labs':
    default:
      return { details: 'Browsing Labs', state: APP_NAME }
  }
}

export function setDiscordRpcEnabled(value) {
  enabled = Boolean(value)
  if (!enabled) {
    state = 'disabled'
    void shutdownDiscordRpc()
  } else {
    state = 'disconnected'
    void connectClient()
  }
}

export function getDiscordRpcStatus() {
  if (!enabled) {
    return { state: 'disabled', enabled: false, label: 'Disabled', variant: 'neutral' }
  }
  if (state === 'connected') {
    return { state, enabled: true, label: 'Connected', variant: 'success' }
  }
  if (state === 'unavailable') {
    return { state, enabled: true, label: 'Discord unavailable', variant: 'warning' }
  }
  return { state: 'disconnected', enabled: true, label: 'Connecting…', variant: 'warning' }
}

export async function initDiscordRpc() {
  loadApplicationId()
  if (!enabled) {
    state = 'disabled'
    return getDiscordRpcStatus()
  }
  await connectClient()
  return getDiscordRpcStatus()
}

export async function refreshDiscordRpcStatus() {
  return getDiscordRpcStatus()
}

/**
 * @param {{ page?: string, labTitle?: string, completedLab?: string, context?: string }} payload
 */
export async function updateDiscordPresence(payload = {}) {
  if (!enabled) return getDiscordRpcStatus()

  const presence = resolveDiscordPresence(sanitizeDiscordPresencePayload(payload))
  await applyActivity(presence)
  if (state !== 'connected') {
    void connectClient()
  }
  return getDiscordRpcStatus()
}

export async function shutdownDiscordRpc() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (client) {
    try {
      await client.destroy()
    } catch {
      // ignore
    }
    client = null
  }
  if (enabled) state = 'disconnected'
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { contextBridge, ipcRenderer } from 'electron'

/**
 * @param {string} channel
 */
const invoke = async (channel, ...args) => {
  try {
    return await ipcRenderer.invoke(channel, ...args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/No handler registered/i.test(message)) {
      console.error(`[sysadmin-game preload] IPC channel not registered: ${channel}`, error)
    }
    throw error
  }
}

contextBridge.exposeInMainWorld('api', {
  version: '0.1.0',

  system: {
    ping: () => invoke('system:ping')
  },

  app: {
    ping: () => invoke('app:ping'),
    openExternal: (url) => invoke('app:openExternal', url),
    readClipboardText: () => invoke('app:readClipboardText'),
    writeClipboardText: (text) => invoke('app:writeClipboardText', text),
    quit: () => invoke('app:quit'),
    openDataFolder: () => invoke('app:openDataFolder'),
    openDoc: (docId) => invoke('app:openDoc', docId),
    runCleanupNow: () => invoke('app:runCleanupNow'),
    getStaleLabResources: () => invoke('app:getStaleLabResources'),
    cleanupStaleLabResources: () => invoke('app:cleanupStaleLabResources'),
    keepStaleLabResources: () => invoke('app:keepStaleLabResources'),
    toggleFullscreen: () => invoke('app:toggleFullscreen'),
    isFullscreen: () => invoke('app:isFullscreen')
  },

  tools: {
    getStatus: () => invoke('tools:getStatus'),
    refreshStatus: () => invoke('tools:refreshStatus'),
    refreshTool: (toolId) => invoke('tools:refreshTool', toolId)
  },

  wsl: {
    getStatus: () => invoke('wsl:getStatus'),
    convertPath: (payload) => invoke('wsl:convertPath', payload),
    runDiagnostic: (diagnosticId, distro) => invoke('wsl:runDiagnostic', diagnosticId, distro)
  },

  setup: {
    runWindowsChecks: (payload) => invoke('setup:runWindowsChecks', payload),
    markWindowsComplete: (payload) => invoke('setup:markWindowsComplete', payload)
  },

  labs: {
    list: () => invoke('labs:list'),
    importLabPack: (payload) => invoke('labs:importLabPack', payload),
    get: (labId) => invoke('labs:get', labId),
    incidentBriefing: (labId) => invoke('labs:incidentBriefing', labId),
    readAttachment: (labId, filename) => invoke('labs:readAttachment', labId, filename),
    recordTelemetry: (sessionId, payload) => invoke('labs:recordTelemetry', sessionId, payload),
    workstationOptions: (labId) => invoke('labs:workstationOptions', labId),
    start: (labId, startOptions) => invoke('labs:start', labId, startOptions),
    cancelStart: (sessionId, labId) => invoke('labs:cancelStart', sessionId, labId),
    cleanupFailedStartup: (sessionId, labId) => invoke('labs:cleanupFailedStartup', sessionId, labId),
    onStartProgress: (callback) => {
      const handler = (_event, payload) => callback(payload)
      ipcRenderer.on('mission:start-progress', handler)
      return () => ipcRenderer.removeListener('mission:start-progress', handler)
    },
    openLocalTerminal: (sessionId) => invoke('labs:openLocalTerminal', sessionId),
    enterSession: (sessionId) => invoke('labs:enterSession', sessionId),
    forceDesktopReady: (sessionId) => invoke('labs:forceDesktopReady', sessionId),
    openDesktopWindow: (payload) => invoke('labs:openDesktopWindow', payload),
    listRecoverableDesktopSetups: () => invoke('labs:listRecoverableDesktopSetups'),
    resumeDesktopSetup: (sessionId) => invoke('labs:resumeDesktopSetup', sessionId),
    stop: (sessionId, options) => invoke('labs:stop', sessionId, options),
    retryCleanup: (sessionId, options) => invoke('labs:retryCleanup', sessionId, options),
    listSessionResources: (sessionId) => invoke('labs:listSessionResources', sessionId),
    reset: (sessionId) => invoke('labs:reset', sessionId),
    destroy: (sessionId) => invoke('labs:destroy', sessionId),
    getSessionState: (sessionId) => invoke('labs:getSessionState', sessionId),
    listActiveSessions: () => invoke('labs:listActiveSessions'),
    refreshServiceRoutes: (sessionId) => invoke('labs:refreshServiceRoutes', sessionId),
    refreshWorkstationAccessRoutes: (sessionId) =>
      invoke('labs:refreshWorkstationAccessRoutes', sessionId),
    testSshReadiness: (sessionId) => invoke('labs:testSshReadiness', sessionId),
    getObjectives: (sessionId) => invoke('labs:getObjectives', sessionId),
    validate: (sessionId, payload) => invoke('labs:validate', sessionId, payload),
    submitObjectiveAnswer: (sessionId, objectiveId, answer, questionId) =>
      invoke('labs:submitObjectiveAnswer', sessionId, objectiveId, answer, questionId)
  },

  labTerminal: {
    open: (sessionId) => invoke('labTerminal:open', sessionId)
  },

  terminal: {
    openWindow: (sessionId) => invoke('terminal:openWindow', sessionId),
    checkPty: () => invoke('terminal:checkPty'),
    getDebugLog: (sessionId) => invoke('terminal:getDebugLog', sessionId),
    getStatus: (sessionId) => invoke('terminal:getStatus', sessionId),
    attach: (sessionId, options) => invoke('terminal:attach', sessionId, options),
    write: (terminalId, data) => invoke('terminal:write', terminalId, data),
    resize: (terminalId, cols, rows) => invoke('terminal:resize', terminalId, cols, rows),
    detach: (terminalId) => invoke('terminal:detach', terminalId),
    onData: (callback) => {
      const handler = (_event, payload) => callback(payload)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (callback) => {
      const handler = (_event, payload) => callback(payload)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    }
  },

  data: {
    getInfo: () => invoke('data:getInfo'),
    resetAll: (options) => invoke('data:resetAll', options)
  },

  profile: {
    getLabProfile: () => invoke('profile:getLabProfile'),
    saveLabProfile: (partial) => invoke('profile:saveLabProfile', partial)
  },

  progress: {
    get: () => invoke('progress:get'),
    getStats: () => invoke('progress:getStats'),
    getAchievements: () => invoke('progress:getAchievements'),
    reset: () => invoke('progress:reset'),
    consumeNotifications: () => invoke('progress:consumeNotifications'),
    seedDemoActivity: () => invoke('progress:seedDemoActivity')
  },

  questions: {
    list: () => invoke('questions:list'),
    submit: (questionId, answer) => invoke('questions:submit', questionId, answer)
  },

  settings: {
    get: () => invoke('settings:get'),
    set: (partial, options) => invoke('settings:set', partial, options)
  },

  workstation: {
    listProfiles: () => invoke('workstation:listProfiles'),
    getCapabilities: () => invoke('workstation:getCapabilities'),
    testWindowsContainers: () => invoke('workstation:testWindowsContainers'),
    resolve: (labId) => invoke('workstation:resolve', labId)
  },

  desktopRuntime: {
    list: () => invoke('desktopRuntime:list'),
    save: (payload) => invoke('desktopRuntime:save', payload),
    test: (payload) => invoke('desktopRuntime:test', payload)
  },

  discord: {
    getStatus: () => invoke('discord:getStatus'),
    updatePresence: (payload) => invoke('discord:updatePresence', payload)
  },

  security: {
    getStatus: () => invoke('security:getStatus')
  },

  online: {
    getStatus: () => invoke('online:getStatus'),
    deviceLinkStart: () => invoke('online:deviceLinkStart'),
    deviceLinkPoll: (payload) => invoke('online:deviceLinkPoll', payload),
    deviceLinkCancel: (deviceCode) => invoke('online:deviceLinkCancel', deviceCode),
    openVerificationUrl: (url) => invoke('online:openVerificationUrl', url),
    unlink: () => invoke('online:unlink'),
    updatePreferences: (partial) => invoke('online:updatePreferences', partial),
    browseLabs: (filters) => invoke('online:browseLabs', filters),
    getLab: (labId) => invoke('online:getLab', labId),
    downloadLab: (payload) => invoke('online:downloadLab', payload),
    uninstallLab: (labId) => invoke('online:uninstallLab', labId),
    listInstalled: () => invoke('online:listInstalled'),
    reportLab: (payload) => invoke('online:reportLab', payload),
    syncProgress: () => invoke('online:syncProgress'),
    getCloudProgress: () => invoke('online:getCloudProgress'),
    globalLeaderboard: () => invoke('online:globalLeaderboard'),
    labLeaderboard: (labId) => invoke('online:labLeaderboard', labId),
    getNotificationPreferences: () => invoke('online:getNotificationPreferences'),
    updateNotificationPreferences: (preferences) => invoke('online:updateNotificationPreferences', preferences),
    resendVerification: () => invoke('online:triggerNotification', { event: 'resend_verification' }),
    requestPasswordReset: () => invoke('online:triggerNotification', { event: 'password_reset' }),
    getPasswordResetUrl: () => invoke('online:getPasswordResetUrl'),
    revokeRemoteSessions: () => invoke('online:revokeRemoteSessions')
  },

  labBuilder: {
    listDrafts: () => invoke('labBuilder:listDrafts'),
    createDraft: (options) => invoke('labBuilder:createDraft', options),
    getDraft: (draftId) => invoke('labBuilder:getDraft', draftId),
    saveDraft: (draftId, payload) => invoke('labBuilder:saveDraft', draftId, payload),
    deleteDraft: (draftId) => invoke('labBuilder:deleteDraft', draftId),
    duplicateDraft: (draftId, newLabId) => invoke('labBuilder:duplicateDraft', draftId, newLabId),
    validateDraft: (draftId) => invoke('labBuilder:validateDraft', draftId),
    analyzeDraft: (draftId) => invoke('labBuilder:analyzeDraft', draftId),
    templateList: () => invoke('labBuilder:templateList'),
    applyTemplate: (draftId, presetKey) => invoke('labBuilder:applyTemplate', draftId, presetKey),
    generateReadme: (draftId) => invoke('labBuilder:generateReadme', draftId),
    importLabFolder: () => invoke('labBuilder:importLabFolder'),
    importAssets: (payload) => invoke('labBuilder:importAssets', payload),
    exportDraft: (opts) => invoke('labBuilder:exportDraft', opts),
    publishDraft: (opts) => invoke('labBuilder:publishDraft', opts),
    buildTestDraft: (draftId) => invoke('labBuilder:buildTestDraft', draftId),
    stopTestSession: (sessionId) => invoke('labBuilder:stopTestSession', sessionId),
    classifyDockerImage: (payload) => invoke('labBuilder:classifyDockerImage', payload),
    previewDraft: (draftId) => invoke('labBuilder:previewDraft', draftId),
    previewLab: (payload) => invoke('labBuilder:previewLab', payload),
    applyMockWebsite: (draftId) => invoke('labBuilder:applyMockWebsite', draftId)
  }
})

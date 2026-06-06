/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { BrowserWindow, app, clipboard, dialog, ipcMain, shell } from 'electron'
import fs from 'fs'
import { closeDatabase, getDatabaseState, initDatabase } from '../db/database.js'
import {
  ensureDataDirectories,
  getDataDirectoryInfo,
  resetAllLocalData
} from '../dataDirectoryManager.js'
import { evaluateSessionObjectives, submitObjectiveAnswer } from '../autoProgressManager.js'
import { resolveAcceptedAnswers } from '../objectiveAnswers.js'
import { mergeObjectiveRowsForDisplay } from '../labObjectives.js'
import { openLocalWorkstationTerminal } from '../localTerminal/localTerminalManager.js'
import { windowsPathToWsl, wslPathToWindows, getExamplePathConversions } from '../wsl/wslPaths.js'
import { runWslDiagnostic, listWslDiagnosticIds } from '../wsl/wslCommandRunner.js'
import { detectWslEnvironment } from '../wsl/wslDetection.js'
import {
  cleanupAllManagedResources,
  cleanupStaleResourcesNow,
  consumePendingStaleResourceScan,
  registerActiveSessionIdsProvider,
  scanStaleManagedLabResources
} from '../labCleanupManager.js'
import { loadDesktopRecoverySnapshot } from '../desktopSetupRecovery.js'
import {
  getDiscordRpcStatus,
  setDiscordRpcEnabled,
  updateDiscordPresence
} from '../discordRpcManager.js'
import * as labBuilderManager from '../labBuilderManager.js'
import * as labManager from '../labManager.js'
import { recordHintOpened, recordLabCommand } from '../labSessionTelemetry.js'
import { CredentialSetupError } from '../credentialManager.js'
import { WorkstationStartError } from '../workstation/workstationStartError.js'
import {
  cancelMissionStartup,
  createMissionStartupProgress,
  MissionStartCancelledError,
  unregisterMissionStartup
} from '../missionStartupProgress.js'
import { forceDesktopReadiness } from '../workstation/desktopReadinessControl.js'
import { createSessionId } from '../utils/sanitize.js'
import { DOCKER_TEMPLATES } from '../labBuilderTemplates.js'
import { validateLabSession } from '../validationManager.js'
import { collectSystemStatus, getCachedSystemStatus, refreshSingleTool } from '../systemStatus.js'
import {
  clearActivityStore,
  consumeNotifications,
  getLabProfile,
  getProfile as getLegacyProfile,
  isLabProfileSetupComplete,
  pushActivity,
  saveLabProfile
} from '../profileManager.js'
import {
  getAchievements,
  getProgressOverview,
  getStats,
  migrateFromLegacyProfile,
  resetProgress,
  unlockDockerReadyAchievement
} from '../progressManager.js'
import { listQuestions, submitQuestionAnswer } from '../questionManager.js'
import { getAllSettings, updateSettings as updateAppSettings } from '../settingsManager.js'
import {
  detectWorkstationCapabilities,
  listWorkstationDeploymentOptions,
  buildFallbackWorkstationDeploymentOptions,
  listWorkstationOptionsForSettings,
  resolveWorkstationChoice,
  testWindowsContainerSupport,
  validateWorkstationDeploymentChoice
} from '../workstationProfiles.js'
import { getLab } from '../labManager.js'
import { labRequiresWorkstationSelection, resolveLabMode } from '../lab/labMode.js'
import { getWorkstationProfile } from '../workstation/workstationCatalog.js'
import { classifyDockerImageTrust } from '../dockerImageTrust.js'
import { getConfigPath, getDocsPath, logResolvedPaths } from '../utils/paths.js'
import { logger } from '../utils/logger.js'
import { registerOnlineHandlers } from './onlineHandlers.js'
import {
  attachLabTerminal,
  detachAllTerminals,
  detachLabTerminal,
  getTerminalStatusForSession,
  resizeLabTerminal,
  writeLabTerminal
} from '../terminalManager.js'
import {
  closeAllLabTerminalWindows,
  getLabTerminalWindowStatus,
  openLabTerminalWindow,
  showTerminalErrorDialog
} from '../terminalWindowManager.js'
import { openDesktopViewerWindow } from '../desktopViewerWindowManager.js'
import { formatTerminalDebugLog, getTerminalDebugLog } from '../terminalDebug.js'
import { checkPtyAvailable } from '../terminalManager.js'
import { fail, fromError, ok } from './response.js'
import { importLocalLabPack } from '../online/labPackVerifier.js'
import { confirmAndOpenExternal } from '../security/electronSecurity.js'
import { requireDeveloperMode } from '../security/devGate.js'
import {
  IpcValidationError,
  logIpcValidationFailure,
  parseDataResetOptions,
  parseDiscordPresence,
  parseDocId,
  parseExternalUrl,
  parseClipboardText,
  parseLabId,
  parseSessionId,
  parseSettingsPatch,
  parseTerminalId,
  parseTerminalWrite
} from '../security/ipcValidation.js'
import { collectSecurityStatus } from '../security/securityStatus.js'
/** @type {import('electron').BrowserWindow | null} */
let mainWindowRef = null

let ipcHandlersRegistered = false

/**
 * @param {string} channel
 * @param {unknown} err
 */
function ipcValidationFail(channel, err) {
  logIpcValidationFailure(channel, err)
  const message = err instanceof IpcValidationError ? err.message : 'Invalid input'
  return fail('INVALID_INPUT', message)
}

function loadRanks() {
  const file = getConfigPath('app.defaults.json')
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8'))
    return config.ranks ?? defaultRanks()
  } catch {
    return defaultRanks()
  }
}

function defaultRanks() {
  return [
    { minLevel: 1, title: 'Player' },
    { minLevel: 2, title: 'Junior Admin' },
    { minLevel: 3, title: 'SysAdmin Apprentice' },
    { minLevel: 4, title: 'SysAdmin' },
    { minLevel: 5, title: 'Senior SysAdmin' },
    { minLevel: 6, title: 'Infrastructure Engineer' },
    { minLevel: 7, title: 'SRE' },
    { minLevel: 8, title: 'Datacenter Architect' }
  ]
}

function mergeProfilePayload(overview) {
  const legacy = getLegacyProfile()
  return {
    ...overview,
    profile: {
      ...overview.profile,
      displayName: legacy.displayName ?? legacy.username,
      labProfile: getLabProfile(),
      activity: legacy.activity ?? [],
      streak: legacy.streak ?? 0,
      lastLabId: legacy.lastLabId ?? null
    }
  }
}

function maybeUnlockDockerAchievement(status) {
  if (status?.dockerReady) {
    unlockDockerReadyAchievement()
  }
}

/**
 * @param {import('electron').BrowserWindow} [mainWindow]
 */
export function registerIpcHandlers(mainWindow) {
  if (mainWindow) {
    mainWindowRef = mainWindow
  }

  if (ipcHandlersRegistered) {
    return
  }
  ipcHandlersRegistered = true

  const handleSystemPing = async () =>
    ok({
      main: true,
      preload: true,
      timestamp: Date.now()
    })

  ipcMain.handle('system:ping', handleSystemPing)

  ipcMain.handle('app:ping', async () => {
    const result = await handleSystemPing()
    if (!result.ok) return result
    return ok({
      ...result.data,
      pong: true,
      version: '0.1.0'
    })
  })

  ipcMain.handle('app:quit', async () => {
    try {
      app.quit()
      return ok({ quitting: true })
    } catch (error) {
      return fromError('app.quit', error, 'APP_QUIT_FAILED')
    }
  })

  ipcMain.handle('app:openDataFolder', async () => {
    try {
      const info = getDataDirectoryInfo()
      await shell.openPath(info.root)
      return ok({ opened: true, path: info.root })
    } catch (error) {
      return fromError('app.openDataFolder', error, 'APP_OPEN_DATA_FAILED')
    }
  })

  ipcMain.handle('app:openDoc', async (_event, docId) => {
    let safeDocId
    try {
      safeDocId = parseDocId(docId)
    } catch (error) {
      return ipcValidationFail('app:openDoc', error)
    }
    const map = {
      'security-model': getDocsPath('security-model.md'),
      'creating-labs': getDocsPath('creating-labs.md'),
      'lab-builder': getDocsPath('lab-builder.md'),
      'security-hardening': getDocsPath('security-hardening.md'),
      'threat-model': getDocsPath('threat-model.md'),
      'windows-build': getDocsPath('windows-build.md'),
      'security-electron-notes': getDocsPath('security-electron-notes.md')
    }
    const target = map[safeDocId] ?? null
    if (!target) return fail('INVALID_DOC', 'Unknown doc id')
    try {
      await shell.openPath(target)
      return ok({ opened: true, path: target })
    } catch (error) {
      return fromError('app.openDoc', error, 'APP_OPEN_DOC_FAILED')
    }
  })

  ipcMain.handle('app:runCleanupNow', async () => {
    try {
      return ok(
        await cleanupAllManagedResources({
          ephemeralOnly: true,
          removeImagesWhenCacheDisabled: true
        })
      )
    } catch (error) {
      return fromError('app.runCleanupNow', error, 'APP_CLEANUP_FAILED')
    }
  })

  ipcMain.handle('app:getStaleLabResources', async () => {
    try {
      const scan = consumePendingStaleResourceScan() ?? (await scanStaleManagedLabResources())
      return ok(scan)
    } catch (error) {
      return fromError('app.getStaleLabResources', error, 'APP_STALE_SCAN_FAILED')
    }
  })

  ipcMain.handle('app:cleanupStaleLabResources', async () => {
    try {
      return ok(await cleanupStaleResourcesNow())
    } catch (error) {
      return fromError('app.cleanupStaleLabResources', error, 'APP_STALE_CLEANUP_FAILED')
    }
  })

  ipcMain.handle('app:keepStaleLabResources', async () => {
    consumePendingStaleResourceScan()
    return ok({ kept: true })
  })

  ipcMain.handle('app:openExternal', async (_event, url) => {
    let safeUrl
    try {
      safeUrl = parseExternalUrl(url)
    } catch (error) {
      return ipcValidationFail('app:openExternal', error)
    }
    try {
      const result = await confirmAndOpenExternal(safeUrl, mainWindowRef)
      if (!result.opened) {
        return fail('OPEN_EXTERNAL_CANCELED', 'Link was not opened')
      }
      return ok(null)
    } catch (error) {
      return fromError('app.openExternal', error, 'OPEN_EXTERNAL_FAILED')
    }
  })

  ipcMain.handle('app:readClipboardText', async () => {
    try {
      return ok({ text: clipboard.readText() })
    } catch (error) {
      return fromError('app.readClipboardText', error, 'CLIPBOARD_READ_FAILED')
    }
  })

  ipcMain.handle('app:writeClipboardText', async (_event, text) => {
    let safeText
    try {
      safeText = parseClipboardText(text)
    } catch (error) {
      return ipcValidationFail('app:writeClipboardText', error)
    }
    try {
      clipboard.writeText(safeText)
      return ok({ written: true })
    } catch (error) {
      return fromError('app.writeClipboardText', error, 'CLIPBOARD_WRITE_FAILED')
    }
  })

  ipcMain.handle('app:toggleFullscreen', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindowRef
    if (!win) return fail('NO_WINDOW', 'No active window')
    const next = !win.isFullScreen()
    win.setFullScreen(next)
    return ok({ fullscreen: next })
  })

  ipcMain.handle('app:isFullscreen', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindowRef
    return ok({ fullscreen: win?.isFullScreen() ?? false })
  })

  ipcMain.handle('tools:getStatus', async () => {
    try {
      const status = getCachedSystemStatus() ?? (await collectSystemStatus())
      maybeUnlockDockerAchievement(status)
      return ok(status)
    } catch (error) {
      return fromError('tools.getStatus', error, 'TOOLS_STATUS_FAILED')
    }
  })

  ipcMain.handle('tools:refreshStatus', async () => {
    try {
      const status = await collectSystemStatus()
      maybeUnlockDockerAchievement(status)
      return ok(status)
    } catch (error) {
      return fromError('tools.refreshStatus', error, 'TOOLS_REFRESH_FAILED')
    }
  })

  ipcMain.handle('tools:refreshTool', async (_event, toolId) => {
    try {
      if (!toolId || typeof toolId !== 'string') {
        return fail('INVALID_TOOL', 'Tool id is required')
      }
      const status = await refreshSingleTool(toolId)
      maybeUnlockDockerAchievement(status)
      return ok(status)
    } catch (error) {
      return fromError('tools.refreshTool', error, 'TOOLS_REFRESH_TOOL_FAILED')
    }
  })

  ipcMain.handle('wsl:getStatus', async () => {
    try {
      const snap = await detectWslEnvironment({ refresh: true })
      const pathExamples = getExamplePathConversions()
      return ok({ ...snap, pathExamples, diagnosticIds: listWslDiagnosticIds() })
    } catch (error) {
      return fromError('wsl.getStatus', error, 'WSL_STATUS_FAILED')
    }
  })

  ipcMain.handle('wsl:convertPath', async (_event, payload) => {
    try {
      const direction = payload?.direction === 'wslToWindows' ? 'wslToWindows' : 'windowsToWsl'
      const inputPath = typeof payload?.path === 'string' ? payload.path.trim() : ''
      if (!inputPath) {
        return fail('INVALID_PATH', 'Path is required')
      }
      const converted =
        direction === 'wslToWindows' ? wslPathToWindows(inputPath) : windowsPathToWsl(inputPath)
      return ok({ input: inputPath, converted, direction })
    } catch (error) {
      return fromError('wsl.convertPath', error, 'WSL_PATH_FAILED')
    }
  })

  ipcMain.handle('wsl:runDiagnostic', async (_event, diagnosticId, distro) => {
    try {
      if (process.platform !== 'win32') {
        return fail('WSL_NOT_WINDOWS', 'WSL diagnostics are only available on Windows.')
      }
      const result = await runWslDiagnostic(
        typeof diagnosticId === 'string' ? diagnosticId : '',
        typeof distro === 'string' ? distro : undefined
      )
      return ok(result)
    } catch (error) {
      return fromError('wsl.runDiagnostic', error, 'WSL_DIAGNOSTIC_FAILED')
    }
  })

  ipcMain.handle('setup:runWindowsChecks', async (_event, payload) => {
    try {
      const { runWindowsSetupWizardChecks } = await import('../windowsSetupWizard.js')
      const result = await runWindowsSetupWizardChecks({
        runHelloWorld: payload?.runHelloWorld === true
      })
      return ok(result)
    } catch (error) {
      return fromError('setup.runWindowsChecks', error, 'SETUP_CHECKS_FAILED')
    }
  })

  ipcMain.handle('setup:markWindowsComplete', async (_event, payload) => {
    try {
      const { markWindowsSetupComplete } = await import('../windowsSetupWizard.js')
      const complete = payload?.complete !== false
      return ok(markWindowsSetupComplete(complete))
    } catch (error) {
      return fromError('setup.markWindowsComplete', error, 'SETUP_MARK_FAILED')
    }
  })

  ipcMain.handle('labs:list', async () => {
    try {
      return ok(labManager.listLabs())
    } catch (error) {
      return fromError('labs.list', error, 'LABS_LIST_FAILED')
    }
  })

  ipcMain.handle('labs:importLabPack', async (_event, payload) => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindowRef
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
        properties: ['openFile'],
        filters: [{ name: 'Lab pack', extensions: ['zip'] }]
      })
      if (canceled || !filePaths?.[0]) {
        return fail('CANCELLED', 'Import cancelled')
      }
      const zipBuffer = fs.readFileSync(filePaths[0])
      const result = importLocalLabPack(zipBuffer, {
        confirmUnverified: payload?.confirmUnverified === true
      })
      return ok(result)
    } catch (error) {
      return fromError('labs.importLabPack', error, 'LAB_IMPORT_FAILED')
    }
  })

  ipcMain.handle('labs:incidentBriefing', async (_event, labId) => {
    let safeLabId
    try {
      safeLabId = parseLabId(labId)
    } catch (error) {
      return ipcValidationFail('labs:incidentBriefing', error)
    }
    try {
      return ok(labManager.getIncidentBriefing(safeLabId))
    } catch (error) {
      return fromError('labs.incidentBriefing', error, 'LAB_INCIDENT_BRIEFING_FAILED')
    }
  })

  ipcMain.handle('labs:readAttachment', async (_event, labId, filename) => {
    let safeLabId
    try {
      safeLabId = parseLabId(labId)
    } catch (error) {
      return ipcValidationFail('labs:readAttachment', error)
    }
    try {
      if (!filename || typeof filename !== 'string') {
        return fail('INVALID_PAYLOAD', 'filename is required')
      }
      return ok(labManager.readLabAttachment(safeLabId, filename))
    } catch (error) {
      return fromError('labs.readAttachment', error, 'LAB_ATTACHMENT_READ_FAILED')
    }
  })

  ipcMain.handle('labs:recordTelemetry', async (_event, sessionId, payload) => {
    try {
      const safeSessionId = parseSessionId(sessionId)
      if (payload?.type === 'command' && typeof payload.command === 'string') {
        recordLabCommand(safeSessionId, payload.command)
      } else if (payload?.type === 'hint') {
        recordHintOpened(safeSessionId)
      }
      return ok({ recorded: true })
    } catch (error) {
      return fromError('labs.recordTelemetry', error, 'LAB_TELEMETRY_FAILED')
    }
  })

  ipcMain.handle('labs:get', async (_event, labId) => {
    let safeLabId
    try {
      safeLabId = parseLabId(labId)
    } catch (error) {
      return ipcValidationFail('labs:get', error)
    }
    try {
      return ok(labManager.getLab(safeLabId))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail('LAB_NOT_FOUND', message)
    }
  })

  ipcMain.handle('labs:workstationOptions', async (_event, labId) => {
    let safeLabId
    try {
      safeLabId = parseLabId(labId)
    } catch (error) {
      return ipcValidationFail('labs:workstationOptions', error)
    }
    try {
      const lab = labManager.getLab(safeLabId)
      if (!lab) {
        return fail('LAB_NOT_FOUND', `Lab not found: ${safeLabId}`)
      }
      if (!labRequiresWorkstationSelection(lab)) {
        return ok({ options: [], environment: null })
      }
      return ok(await listWorkstationDeploymentOptions(lab))
    } catch (error) {
      logger.warn('labs.workstationOptions', 'Returning fallback workstation options', {
        labId: safeLabId,
        error: error instanceof Error ? error.message : String(error)
      })
      const lab = labManager.getLab(safeLabId)
      if (lab) {
        return ok(buildFallbackWorkstationDeploymentOptions(lab))
      }
      return fromError('labs.workstationOptions', error, 'LAB_WORKSTATION_OPTIONS_FAILED')
    }
  })

  ipcMain.handle('labs:start', async (event, labId, startOptions) => {
    let safeLabId
    try {
      safeLabId = parseLabId(labId)
    } catch (error) {
      return ipcValidationFail('labs:start', error)
    }
    try {
      if (getAllSettings().disclaimerAccepted !== true) {
        return fail('DISCLAIMER_REQUIRED', 'Please accept the Community Lab Disclaimer before starting labs.')
      }

      const lab = labManager.getLab(safeLabId)
      if (!lab) {
        return fail('LAB_NOT_FOUND', `Lab not found: ${safeLabId}`)
      }

      const labMode = resolveLabMode(lab)

      let workstationPreference = 'auto'
      let workstationProfileId = null
      let chosenOption = null

      if (labRequiresWorkstationSelection(lab)) {
        workstationPreference =
          typeof startOptions?.workstationPreference === 'string'
            ? startOptions.workstationPreference.trim()
            : 'auto'
        const deployPayload = await listWorkstationDeploymentOptions(lab)
        const deployOptions = deployPayload?.options ?? deployPayload
        const isoSelection = {
          selectedWorkstationIsoPath:
            typeof startOptions?.selectedWorkstationIsoPath === 'string'
              ? startOptions.selectedWorkstationIsoPath.trim()
              : typeof startOptions?.isoPath === 'string'
                ? startOptions.isoPath.trim()
                : null,
          selectedWorkstationIsoType:
            typeof startOptions?.selectedWorkstationIsoType === 'string'
              ? startOptions.selectedWorkstationIsoType.trim()
              : null,
          isoPath: typeof startOptions?.isoPath === 'string' ? startOptions.isoPath.trim() : null
        }
        const choiceCheck = validateWorkstationDeploymentChoice(
          workstationPreference,
          deployOptions,
          isoSelection
        )
        if (!choiceCheck.valid) {
          return fail('WORKSTATION_NOT_ALLOWED', choiceCheck.message ?? 'Workstation choice is not allowed.')
        }
        chosenOption = choiceCheck.option
        workstationProfileId =
          chosenOption?.profileId ??
          (workstationPreference === 'auto'
            ? getWorkstationProfile(lab.workstation?.recommended ?? 'ubuntu-terminal', lab)?.id
            : getWorkstationProfile(workstationPreference, lab)?.id) ??
          null
      }

      const sessionId = createSessionId()
      const partialRef = { sessionId }
      const progress = createMissionStartupProgress(event.sender, sessionId)
      progress.emit('prepare', { status: 'running' })

      try {
        const session = await labManager.startLab(safeLabId, {
          progress,
          partialRef,
          existingSessionId: sessionId,
          workstationPreference,
          workstationProfileId: workstationProfileId ?? undefined
        })
        const lab = labManager.getLab(safeLabId)
        void updateDiscordPresence({ labTitle: lab.title })
        return ok(session)
      } catch (error) {
        if (error instanceof MissionStartCancelledError) {
          await labManager.abortMissionStartup(sessionId, safeLabId, partialRef)
          return fail('MISSION_START_CANCELED', 'Lab start canceled')
        }

        const settings = getAllSettings()
        const preserveContainers = settings.developerMode === true

        let credentialReport = ''
        if (error instanceof WorkstationStartError) {
          credentialReport = error.diagnostics?.report ?? ''
        } else if (error instanceof CredentialSetupError) {
          credentialReport = error.diagnostics?.report ?? ''
        }

        const raw = error instanceof Error ? error.message : String(error)

        await labManager.abortMissionStartup(sessionId, safeLabId, partialRef, {
          preserveContainers
        })

        const reportHeading =
          error instanceof WorkstationStartError
            ? '--- workstation / desktop VM diagnostics ---'
            : '--- credential setup diagnostics ---'

        const developerDetails =
          settings.developerMode === true
            ? [
                error instanceof WorkstationStartError
                  ? raw
                  : error instanceof Error
                    ? error.stack ?? error.message
                    : raw,
                credentialReport ? `${reportHeading}\n${credentialReport}` : ''
              ]
                .filter(Boolean)
                .join('\n\n')
            : credentialReport
              ? `${raw}\n\n--- deployment diagnostics ---\n${credentialReport.split('\n').slice(0, 80).join('\n')}`
              : undefined

        return fail('LAB_START_FAILED', raw, {
          failedStep: progress.lastStep,
          sessionId,
          developerDetails,
          preservedContainers: preserveContainers,
          failedContainers: preserveContainers
            ? {
                targetContainerId: partialRef.targetContainerId ?? null,
                targetContainerName: partialRef.targetContainerName ?? null,
                helperContainerName: partialRef.helperContainerName ?? null,
                helperContainerId: partialRef.helperContainerId ?? null,
                networkName: partialRef.networkName ?? null
              }
            : undefined
        })
      } finally {
        unregisterMissionStartup(sessionId)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail('LAB_START_FAILED', message)
    }
  })

  ipcMain.handle('labs:cancelStart', async (_event, sessionId, labId) => {
    let safeSessionId
    let safeLabId
    try {
      safeSessionId = parseSessionId(sessionId)
      safeLabId = parseLabId(labId)
    } catch (error) {
      return ipcValidationFail('labs:cancelStart', error)
    }
    try {
      const cancelled = cancelMissionStartup(safeSessionId)
      if (!cancelled) {
        await labManager.abortMissionStartup(safeSessionId, safeLabId, { sessionId: safeSessionId })
      }
      return ok({ cancelled: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail('LAB_CANCEL_FAILED', message)
    }
  })

  ipcMain.handle('labs:cleanupFailedStartup', async (_event, sessionId, labId) => {
    let safeSessionId
    let safeLabId
    try {
      safeSessionId = parseSessionId(sessionId)
      safeLabId = parseLabId(labId)
    } catch (error) {
      return ipcValidationFail('labs:cleanupFailedStartup', error)
    }
    try {
      await labManager.abortMissionStartup(safeSessionId, safeLabId, { sessionId: safeSessionId })
      return ok({ cleaned: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail('LAB_CLEANUP_FAILED', message)
    }
  })

  ipcMain.handle('labs:enterSession', async (_event, sessionId) => {
    try {
      const safeSessionId = parseSessionId(sessionId)
      const session = labManager.activateLabSession(safeSessionId)
      return ok(session)
    } catch (error) {
      return fromError('labs.enterSession', error, 'LAB_ENTER_FAILED')
    }
  })

  ipcMain.handle('labs:forceDesktopReady', async (_event, sessionId) => {
    try {
      const safeSessionId = parseSessionId(sessionId)
      const forced = forceDesktopReadiness(safeSessionId)
      if (!forced) {
        return fail('LAB_NOT_WAITING_FOR_DESKTOP', 'Desktop setup is not currently waiting for readiness.')
      }
      return ok({ forced: true, sessionId: safeSessionId })
    } catch (error) {
      return fromError('labs.forceDesktopReady', error, 'LAB_FORCE_DESKTOP_READY_FAILED')
    }
  })

  ipcMain.handle('labs:openDesktopWindow', async (_event, payload) => {
    try {
      const sessionId = parseSessionId(payload?.sessionId)
      const url = typeof payload?.url === 'string' ? payload.url.trim() : ''
      const title = typeof payload?.title === 'string' ? payload.title.trim() : 'Windows Desktop Workstation'
      if (!url) {
        return fail('INVALID_PAYLOAD', 'Desktop URL is required')
      }
      await openDesktopViewerWindow({ sessionId, url, title })
      return ok({ opened: true, sessionId })
    } catch (error) {
      return fromError('labs.openDesktopWindow', error, 'LAB_DESKTOP_WINDOW_FAILED')
    }
  })

  ipcMain.handle('labs:listRecoverableDesktopSetups', async () => {
    try {
      return ok(await labManager.listRecoverableDesktopLabSetups())
    } catch (error) {
      return fromError('labs.listRecoverableDesktopSetups', error, 'LAB_RECOVERABLE_LIST_FAILED')
    }
  })

  ipcMain.handle('labs:resumeDesktopSetup', async (event, sessionId) => {
    let safeSessionId
    try {
      safeSessionId = parseSessionId(sessionId)
    } catch (error) {
      return ipcValidationFail('labs:resumeDesktopSetup', error)
    }
    const progress = createMissionStartupProgress(event.sender, safeSessionId)
    try {
      const session = await labManager.resumeDesktopLabSetup(safeSessionId, { progress })
      void updateDiscordPresence({ page: 'labs' })
      return ok(session)
    } catch (error) {
      if (error instanceof MissionStartCancelledError) {
        const snapshot = loadDesktopRecoverySnapshot(safeSessionId)
        await labManager.abortMissionStartup(safeSessionId, snapshot?.labId ?? 'unknown', {
          sessionId: safeSessionId,
          helperContainerId: snapshot?.helperContainerId,
          targetContainerId: snapshot?.targetContainerId,
          networkName: snapshot?.networkName
        })
        return fail('MISSION_START_CANCELED', 'Desktop setup canceled')
      }
      const message = error instanceof Error ? error.message : String(error)
      return fail('LAB_RESUME_DESKTOP_FAILED', message)
    }
  })

  ipcMain.handle('labs:stop', async (_event, sessionId, options) => {
    let safeSessionId
    try {
      safeSessionId = parseSessionId(sessionId)
    } catch (error) {
      return ipcValidationFail('labs:stop', error)
    }
    try {
      const result = await labManager.stopLab(safeSessionId, {
        force: options?.force === true
      })
      void updateDiscordPresence({ page: 'labs' })
      return ok(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail('LAB_STOP_FAILED', message)
    }
  })

  ipcMain.handle('labs:retryCleanup', async (_event, sessionId, options) => {
    let safeSessionId
    try {
      safeSessionId = parseSessionId(sessionId)
    } catch (error) {
      return ipcValidationFail('labs:retryCleanup', error)
    }
    try {
      const cleanup = await labManager.retryLabSessionCleanup(safeSessionId, {
        force: options?.force === true
      })
      return ok(cleanup)
    } catch (error) {
      return fromError('labs.retryCleanup', error, 'LAB_CLEANUP_RETRY_FAILED')
    }
  })

  ipcMain.handle('labs:listSessionResources', async (_event, sessionId) => {
    let safeSessionId
    try {
      safeSessionId = parseSessionId(sessionId)
    } catch (error) {
      return ipcValidationFail('labs:listSessionResources', error)
    }
    try {
      return ok(await labManager.listLabSessionResources(safeSessionId))
    } catch (error) {
      return fromError('labs.listSessionResources', error, 'LAB_LIST_RESOURCES_FAILED')
    }
  })

  ipcMain.handle('labs:openLocalTerminal', async (_event, sessionId) => {
    let safeSessionId
    try {
      safeSessionId = parseSessionId(sessionId)
    } catch (error) {
      return ipcValidationFail('labs:openLocalTerminal', error)
    }
    try {
      return ok(await openLocalWorkstationTerminal(safeSessionId))
    } catch (error) {
      return fromError('labs.openLocalTerminal', error, 'LAB_LOCAL_TERMINAL_FAILED')
    }
  })

  ipcMain.handle('labs:reset', async (_event, sessionId) => {
    let safeSessionId
    try {
      safeSessionId = parseSessionId(sessionId)
    } catch (error) {
      return ipcValidationFail('labs:reset', error)
    }
    try {
      return ok(await labManager.resetLab(safeSessionId))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail('LAB_RESET_FAILED', message)
    }
  })

  ipcMain.handle('labs:destroy', async (_event, sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    try {
      const result = await labManager.destroyLab(sessionId)
      void updateDiscordPresence({ page: 'labs' })
      return ok(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail('LAB_DESTROY_FAILED', message)
    }
  })

  ipcMain.handle('labs:getObjectives', async (_event, sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    try {
      const session = labManager.getSessionState(sessionId)
      const lab = labManager.resolveLabFromSession(session)
      const evaluated = await evaluateSessionObjectives(sessionId, lab.objectives ?? [])
      const objectives = mergeObjectiveRowsForDisplay(lab, evaluated.objectives)
      const allObjectivesComplete =
        objectives.length > 0 && objectives.every((entry) => entry.completed)
      return ok({ ...evaluated, objectives, allObjectivesComplete })
    } catch (error) {
      return fromError('labs.getObjectives', error, 'LAB_OBJECTIVES_FAILED')
    }
  })

  ipcMain.handle('labs:submitObjectiveAnswer', async (_event, sessionId, objectiveId, answer, questionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    if (!objectiveId || typeof objectiveId !== 'string') {
      return fail('INVALID_OBJECTIVE_ID', 'Objective id is required')
    }
    if (typeof answer !== 'string') {
      return fail('INVALID_ANSWER', 'Answer is required')
    }
    try {
      const trimmed = answer.trim()
      if (!trimmed) {
        return fail('EMPTY_ANSWER', 'Enter an answer before submitting.')
      }

      const session = labManager.getSessionState(sessionId)
      const lab = labManager.resolveLabFromSession(session)
      const objective = (lab.objectives ?? []).find((o) => o.id === objectiveId)
      if (!objective) return fail('OBJECTIVE_NOT_FOUND', 'Objective not found')

      const linkedQuestions = (lab.questions ?? []).filter((q) => q.objectiveId === objectiveId)
      const linkedQuestion = questionId
        ? linkedQuestions.find((q) => q.id === questionId)
        : linkedQuestions[0]

      /** @type {string[] | null} */
      let dynamicAnswers = null
      const answerKey = linkedQuestion?.answerKey ?? objective.answerKey
      if (answerKey === 'trainingFlag') {
        const flag = labManager.getSessionSecret?.(sessionId, 'trainingFlag')
        if (typeof flag === 'string' && flag.trim()) {
          const trimmedFlag = flag.trim()
          dynamicAnswers = [trimmedFlag, `Flag: ${trimmedFlag}`]
        }
      } else if (answerKey === 'flagFilename') {
        const name = labManager.getSessionSecret?.(sessionId, 'flagFilename')
        if (typeof name === 'string' && name.trim()) {
          const basename = name.trim()
          dynamicAnswers = basename.startsWith('.')
            ? [basename, basename.slice(1)]
            : [basename, `.${basename}`]
        }
      } else if (typeof answerKey === 'string' && answerKey.startsWith('flag:')) {
        const flagValue = labManager.getSessionSecret?.(sessionId, answerKey)
        if (typeof flagValue === 'string' && flagValue.trim()) dynamicAnswers = [flagValue]
      }

      if (answerKey && (!dynamicAnswers || dynamicAnswers.length === 0)) {
        return fail('SESSION_NOT_READY', 'Lab session is still initializing. Try again in a moment.')
      }

      const accepted = resolveAcceptedAnswers(objective, linkedQuestion ?? null)
      const result = submitObjectiveAnswer(sessionId, objective, trimmed, {
        dynamicAnswers: dynamicAnswers ?? (accepted.length ? accepted : undefined),
        answerConfig: linkedQuestion?.answerConfig ?? objective.answerConfig,
        questionId: questionId ?? linkedQuestion?.id ?? `${objectiveId}-prompt`
      })
      const refreshed = await evaluateSessionObjectives(sessionId, lab.objectives ?? [])
      const objectives = mergeObjectiveRowsForDisplay(lab, refreshed.objectives)
      const allObjectivesComplete =
        objectives.length > 0 && objectives.every((entry) => entry.completed)
      return ok({ ...result, objectives, allObjectivesComplete })
    } catch (error) {
      return fromError('labs.submitObjectiveAnswer', error, 'LAB_OBJECTIVE_ANSWER_FAILED')
    }
  })

  ipcMain.handle('terminal:openWindow', async (_event, sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    try {
      const result = await openLabTerminalWindow(sessionId)
      return ok(result)
    } catch (error) {
      const recovered = getLabTerminalWindowStatus(sessionId)
      if (recovered.windowOpen || recovered.attached) {
        return ok({
          opened: false,
          focused: true,
          windowOpen: recovered.windowOpen,
          attached: recovered.attached,
          terminalId: recovered.terminalId ?? null,
          recovered: true,
          debugLog: formatTerminalDebugLog(sessionId)
        })
      }
      const message = error instanceof Error ? error.message : String(error)
      const debugLog = formatTerminalDebugLog(sessionId)
      showTerminalErrorDialog(mainWindowRef, message, debugLog)
      return { ok: false, error: { code: 'TERMINAL_WINDOW_FAILED', message, debugLog } }
    }
  })

  ipcMain.handle('labTerminal:open', async (_event, sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    try {
      const result = await openLabTerminalWindow(sessionId)
      return ok(result)
    } catch (error) {
      const recovered = getLabTerminalWindowStatus(sessionId)
      if (recovered.windowOpen || recovered.attached) {
        return ok({
          opened: false,
          focused: true,
          windowOpen: recovered.windowOpen,
          attached: recovered.attached,
          terminalId: recovered.terminalId ?? null,
          recovered: true,
          debugLog: formatTerminalDebugLog(sessionId)
        })
      }
      const message = error instanceof Error ? error.message : String(error)
      const debugLog = formatTerminalDebugLog(sessionId)
      showTerminalErrorDialog(mainWindowRef, message, debugLog)
      return { ok: false, error: { code: 'TERMINAL_WINDOW_FAILED', message, debugLog } }
    }
  })

  ipcMain.handle('terminal:checkPty', async () => {
    try {
      return ok(await checkPtyAvailable())
    } catch (error) {
      return fromError('terminal.checkPty', error, 'TERMINAL_PTY_CHECK_FAILED')
    }
  })

  ipcMain.handle('terminal:getDebugLog', async (_event, sessionId) => {
    let safeSessionId
    try {
      requireDeveloperMode()
      safeSessionId = parseSessionId(sessionId)
    } catch (error) {
      if (error instanceof IpcValidationError) {
        return ipcValidationFail('terminal:getDebugLog', error)
      }
      return fail('DEVELOPER_MODE_REQUIRED', error instanceof Error ? error.message : 'Developer Mode required')
    }
    try {
      return ok({ log: formatTerminalDebugLog(safeSessionId), entries: getTerminalDebugLog(safeSessionId) })
    } catch (error) {
      return fromError('terminal.getDebugLog', error, 'TERMINAL_DEBUG_FAILED')
    }
  })

  ipcMain.handle('terminal:getStatus', async (_event, sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    try {
      const windowStatus = getLabTerminalWindowStatus(sessionId)
      const attachStatus = getTerminalStatusForSession(sessionId)
      return ok({ ...windowStatus, ...attachStatus })
    } catch (error) {
      return fromError('terminal.getStatus', error, 'TERMINAL_STATUS_FAILED')
    }
  })

  ipcMain.handle('terminal:attach', async (event, sessionId, options) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    try {
      return ok(await attachLabTerminal(sessionId, event.sender, options ?? {}))
    } catch (error) {
      const base = fromError('terminal.attach', error, 'TERMINAL_ATTACH_FAILED')
      if (
        getAllSettings().developerMode === true &&
        error &&
        typeof error === 'object' &&
        error.helperDebug
      ) {
        base.error = {
          ...base.error,
          helperDebug: error.helperDebug
        }
      }
      return base
    }
  })

  ipcMain.handle('terminal:resize', async (_event, terminalId, cols, rows) => {
    if (!terminalId || typeof terminalId !== 'string') {
      return fail('INVALID_TERMINAL', 'Terminal id is required')
    }
    try {
      return ok(resizeLabTerminal(terminalId, cols, rows))
    } catch (error) {
      return fromError('terminal.resize', error, 'TERMINAL_RESIZE_FAILED')
    }
  })

  ipcMain.handle('terminal:write', async (_event, terminalId, data) => {
    let safeTerminalId
    let safeData
    try {
      safeTerminalId = parseTerminalId(terminalId)
      safeData = parseTerminalWrite(data)
    } catch (error) {
      return ipcValidationFail('terminal:write', error)
    }
    try {
      return ok(writeLabTerminal(safeTerminalId, safeData))
    } catch (error) {
      return fromError('terminal.write', error, 'TERMINAL_WRITE_FAILED')
    }
  })

  ipcMain.handle('terminal:detach', async (_event, terminalId) => {
    if (!terminalId || typeof terminalId !== 'string') {
      return fail('INVALID_TERMINAL', 'Terminal id is required')
    }
    try {
      return ok(detachLabTerminal(terminalId))
    } catch (error) {
      return fromError('terminal.detach', error, 'TERMINAL_DETACH_FAILED')
    }
  })

  ipcMain.handle('data:getInfo', async () => {
    try {
      return ok(getDataDirectoryInfo())
    } catch (error) {
      return fromError('data.getInfo', error, 'DATA_INFO_FAILED')
    }
  })

  ipcMain.handle('data:resetAll', async (_event, options) => {
    let safeOptions
    try {
      safeOptions = parseDataResetOptions(options)
    } catch (error) {
      return ipcValidationFail('data:resetAll', error)
    }
    try {
      resetProgress()
      clearActivityStore()
      const layout = resetAllLocalData({ keepSettings: safeOptions.keepSettings === true })
      return ok(layout)
    } catch (error) {
      return fromError('data.resetAll', error, 'DATA_RESET_FAILED')
    }
  })

  ipcMain.handle('profile:getLabProfile', async () => {
    try {
      return ok({
        profile: getLabProfile(),
        setupComplete: isLabProfileSetupComplete()
      })
    } catch (error) {
      return fromError('profile.getLabProfile', error, 'PROFILE_GET_FAILED')
    }
  })

  ipcMain.handle('profile:saveLabProfile', async (_event, partial) => {
    if (!partial || typeof partial !== 'object') {
      return fail('INVALID_PROFILE', 'Profile payload must be an object')
    }
    try {
      const profile = saveLabProfile(partial)
      return ok({ profile, setupComplete: isLabProfileSetupComplete() })
    } catch (error) {
      return fromError('profile.saveLabProfile', error, 'PROFILE_SAVE_FAILED')
    }
  })

  ipcMain.handle('labs:getSessionState', async (_event, sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    try {
      const settings = getAllSettings()
      const session = labManager.getSanitizedSessionState(sessionId)
      return ok({
        ...session,
        showLabDebugInfo: settings.developerMode === true && settings.showLabDebugInfo === true
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail('LAB_SESSION_NOT_FOUND', message)
    }
  })

  ipcMain.handle('labs:listActiveSessions', async () => {
    try {
      return ok({ sessions: labManager.listActiveSessions() })
    } catch (error) {
      return fromError('labs.listActiveSessions', error, 'LAB_SESSION_LIST_FAILED')
    }
  })

  ipcMain.handle('labs:testSshReadiness', async (_event, sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    if (!getAllSettings().developerMode) {
      return fail('DEVELOPER_MODE_REQUIRED', 'Developer Mode is required for SSH diagnostics')
    }
    try {
      const session = labManager.getSessionState(sessionId)
      const targetId = session.helper?.targetContainerId ?? session.containerId
      if (!targetId) {
        return fail('NO_TARGET', 'Lab target container not found for this session')
      }
      const { testMissionSshReadiness } = await import('../sshDiagnostics.js')
      const result = await testMissionSshReadiness(targetId, sessionId, {
        helperContainerId: session.helper?.containerId ?? null,
        networkName: session.helper?.networkName ?? null
      })
      return ok(result)
    } catch (error) {
      return fromError('labs.testSshReadiness', error, 'SSH_TEST_FAILED')
    }
  })

  ipcMain.handle('labs:refreshServiceRoutes', async (_event, sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    try {
      const result = await labManager.refreshServiceRoutes(sessionId)
      return ok(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail('SERVICE_ROUTES_REFRESH_FAILED', message)
    }
  })

  ipcMain.handle('labs:refreshWorkstationAccessRoutes', async (_event, sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    try {
      const result = await labManager.refreshWorkstationAccessRoutes(sessionId)
      return ok(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail('WORKSTATION_ROUTES_REFRESH_FAILED', message)
    }
  })

  ipcMain.handle('labs:validate', async (_event, sessionId, payload) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return fail('INVALID_SESSION_ID', 'Session id is required')
    }
    try {
      const result = await validateLabSession(sessionId, payload ?? {})
      if (result.passed && result.environmentRemoved) {
        void updateDiscordPresence({ page: 'labs' })
      } else if (result.passed && result.xpAwarded && result.labId) {
        const lab = labManager.getLab(result.labId)
        void updateDiscordPresence({ completedLab: lab.title })
        setTimeout(() => {
          void updateDiscordPresence({ labTitle: lab.title })
        }, 12000)
      }
      return ok(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn('validation', 'Validation failed', { sessionId, message })
      return fail('VALIDATION_FAILED', message)
    }
  })

  ipcMain.handle('progress:get', async () => {
    try {
      const ranks = loadRanks()
      const overview = mergeProfilePayload(
        getProgressOverview(ranks, { activeLabIds: labManager.getActiveLabIds() })
      )
      return ok({
        ...overview,
        database: getDatabaseState(),
        dataDirectory: getDataDirectoryInfo(),
        labProfile: getLabProfile(),
        labProfileSetupComplete: isLabProfileSetupComplete(),
        isDevelopmentUnpackaged: !app.isPackaged
      })
    } catch (error) {
      return fromError('progress.get', error, 'PROGRESS_GET_FAILED')
    }
  })

  ipcMain.handle('progress:getStats', async () => {
    try {
      return ok(getStats())
    } catch (error) {
      return fromError('progress.getStats', error, 'PROGRESS_STATS_FAILED')
    }
  })

  ipcMain.handle('progress:getAchievements', async () => {
    try {
      return ok({ achievements: getAchievements() })
    } catch (error) {
      return fromError('progress.getAchievements', error, 'ACHIEVEMENTS_FAILED')
    }
  })

  ipcMain.handle('progress:reset', async () => {
    try {
      return ok(resetProgress())
    } catch (error) {
      return fromError('progress.reset', error, 'PROGRESS_RESET_FAILED')
    }
  })

  ipcMain.handle('progress:consumeNotifications', async () => {
    try {
      return ok(consumeNotifications())
    } catch (error) {
      return fromError('progress.consumeNotifications', error, 'NOTIFICATIONS_FAILED')
    }
  })

  ipcMain.handle('progress:seedDemoActivity', async () => {
    try {
      pushActivity({
        type: 'mission',
        message: 'Lab control online — IPC bridge ready',
        tone: 'info'
      })
      const ranks = loadRanks()
      return ok(mergeProfilePayload(getProgressOverview(ranks)).profile)
    } catch (error) {
      return fromError('progress.seedDemoActivity', error, 'SEED_ACTIVITY_FAILED')
    }
  })

  ipcMain.handle('questions:list', async () => {
    try {
      return ok({ questions: listQuestions() })
    } catch (error) {
      return fromError('questions.list', error, 'QUESTIONS_LIST_FAILED')
    }
  })

  ipcMain.handle('questions:submit', async (_event, questionId, answer) => {
    if (!questionId || typeof questionId !== 'string') {
      return fail('INVALID_QUESTION', 'Question id is required')
    }
    try {
      return ok(submitQuestionAnswer(questionId, answer ?? ''))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail('QUESTION_SUBMIT_FAILED', message)
    }
  })

  ipcMain.handle('workstation:listProfiles', async () => {
    try {
      return ok(await listWorkstationOptionsForSettings())
    } catch (error) {
      return fromError('workstation.listProfiles', error, 'WORKSTATION_PROFILES_FAILED')
    }
  })

  ipcMain.handle('workstation:getCapabilities', async () => {
    try {
      return ok(await detectWorkstationCapabilities({ refresh: true }))
    } catch (error) {
      return fromError('workstation.getCapabilities', error, 'WORKSTATION_CAPABILITIES_FAILED')
    }
  })

  ipcMain.handle('workstation:testWindowsContainers', async () => {
    try {
      return ok(await testWindowsContainerSupport())
    } catch (error) {
      return fromError('workstation.testWindowsContainers', error, 'WINDOWS_CONTAINER_TEST_FAILED')
    }
  })

  ipcMain.handle('workstation:resolve', async (_event, labId) => {
    try {
      const lab = getLab(labId)
      if (!lab) {
        return fail('LAB_NOT_FOUND', `Lab not found: ${labId}`)
      }
      return ok(await resolveWorkstationChoice(getAllSettings(), lab))
    } catch (error) {
      return fromError('workstation.resolve', error, 'WORKSTATION_RESOLVE_FAILED')
    }
  })

  ipcMain.handle('desktopRuntime:list', async () => {
    try {
      const { listDesktopRuntimes } = await import('../workstation/desktopRuntimeManager.js')
      return ok(await listDesktopRuntimes())
    } catch (error) {
      return fromError('desktopRuntime.list', error, 'DESKTOP_RUNTIME_LIST_FAILED')
    }
  })

  ipcMain.handle('desktopRuntime:save', async (_event, payload) => {
    try {
      const key = payload?.key
      if (!key || typeof key !== 'string') {
        return fail('INVALID_PAYLOAD', 'Desktop runtime key is required')
      }
      const { saveDesktopRuntime } = await import('../workstation/desktopRuntimeManager.js')
      const runtime = saveDesktopRuntime(key, {
        image: payload.image,
        enabled: payload.enabled,
        trusted: payload.trusted,
        registrySource: payload.registrySource
      })
      return ok({ runtime })
    } catch (error) {
      return fromError('desktopRuntime.save', error, 'DESKTOP_RUNTIME_SAVE_FAILED')
    }
  })

  ipcMain.handle('desktopRuntime:test', async (_event, payload) => {
    try {
      const key = payload?.key
      if (!key || typeof key !== 'string') {
        return fail('INVALID_PAYLOAD', 'Desktop runtime key is required')
      }
      const { testDesktopRuntime } = await import('../workstation/desktopRuntimeManager.js')
      const result = await testDesktopRuntime(key, {
        image: payload.image,
        pullOnly: payload.pullOnly === true
      })
      return ok(result)
    } catch (error) {
      return fromError('desktopRuntime.test', error, 'DESKTOP_RUNTIME_TEST_FAILED')
    }
  })

  ipcMain.handle('labBuilder:classifyDockerImage', async (_event, payload) => {
    try {
      const image = payload?.image ?? ''
      const localBuild = payload?.localBuild === true
      return ok(classifyDockerImageTrust(String(image), { localBuild }))
    } catch (error) {
      return fromError('labBuilder.classifyDockerImage', error, 'LAB_BUILDER_IMAGE_TRUST_FAILED')
    }
  })

  ipcMain.handle('settings:get', async () => {
    try {
      return ok(getAllSettings())
    } catch (error) {
      return fromError('settings.get', error, 'SETTINGS_GET_FAILED')
    }
  })

  ipcMain.handle('settings:set', async (_event, partial, options) => {
    let safePartial
    try {
      safePartial = parseSettingsPatch(partial)
    } catch (error) {
      return ipcValidationFail('settings:set', error)
    }
    try {
      const settings = updateAppSettings(safePartial, options ?? {})
      if ('discordRpcEnabled' in safePartial) {
        setDiscordRpcEnabled(safePartial.discordRpcEnabled)
      }
      return ok(settings)
    } catch (error) {
      return fromError('settings.set', error, 'SETTINGS_SET_FAILED')
    }
  })

  ipcMain.handle('security:getStatus', async () => {
    try {
      return ok(await collectSecurityStatus())
    } catch (error) {
      return fromError('security.getStatus', error, 'SECURITY_STATUS_FAILED')
    }
  })

  ipcMain.handle('discord:getStatus', async () => {
    try {
      return ok(getDiscordRpcStatus())
    } catch (error) {
      return fromError('discord.getStatus', error, 'DISCORD_STATUS_FAILED')
    }
  })

  ipcMain.handle('discord:updatePresence', async (_event, payload) => {
    let safePayload
    try {
      safePayload = parseDiscordPresence(payload ?? {})
    } catch (error) {
      return ipcValidationFail('discord:updatePresence', error)
    }
    try {
      return ok(await updateDiscordPresence(safePayload))
    } catch (error) {
      return fromError('discord.updatePresence', error, 'DISCORD_PRESENCE_FAILED')
    }
  })

  function gateLabBuilder() {
    if (!getAllSettings().developerMode) {
      throw new Error('Enable Developer Mode in Settings to use Lab Builder.')
    }
  }

  ipcMain.handle('labBuilder:listDrafts', async () => {
    gateLabBuilder()
    return ok(labBuilderManager.listDrafts())
  })

  ipcMain.handle('labBuilder:createDraft', async (_event, options) => {
    try {
      gateLabBuilder()
    } catch (gateErr) {
      const message = gateErr instanceof Error ? gateErr.message : String(gateErr)
      logger.warn('ipc', 'labBuilder.createDraft blocked', { message })
      return fail('LAB_BUILDER_DISABLED', message)
    }
    try {
      return ok(labBuilderManager.createDraft(options ?? {}))
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      logger.error('ipc', 'labBuilder.createDraft failed', {
        detail,
        stack: error instanceof Error ? error.stack : undefined
      })
      return fail(
        'LAB_BUILDER_CREATE_FAILED',
        `Could not create lab draft. Check app data folder permissions. ${detail}`
      )
    }
  })

  ipcMain.handle('labBuilder:getDraft', async (_event, draftId) => {
    gateLabBuilder()
    try {
      return ok(labBuilderManager.getDraft(draftId))
    } catch (error) {
      return fromError('labBuilder.getDraft', error, 'LAB_BUILDER_GET_FAILED')
    }
  })

  ipcMain.handle('labBuilder:saveDraft', async (_event, draftId, payload) => {
    gateLabBuilder()
    try {
      return ok(labBuilderManager.saveDraft(draftId, payload ?? {}))
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      logger.error('ipc', 'labBuilder.saveDraft failed', {
        draftId,
        detail,
        stack: error instanceof Error ? error.stack : undefined
      })
      return fail('LAB_BUILDER_SAVE_FAILED', detail)
    }
  })

  ipcMain.handle('labBuilder:deleteDraft', async (_event, draftId) => {
    gateLabBuilder()
    try {
      return ok(labBuilderManager.deleteDraft(draftId))
    } catch (error) {
      return fromError('labBuilder.deleteDraft', error, 'LAB_BUILDER_DELETE_FAILED')
    }
  })

  ipcMain.handle('labBuilder:duplicateDraft', async (_event, draftId, newLabId) => {
    gateLabBuilder()
    try {
      return ok(labBuilderManager.duplicateDraft(draftId, newLabId))
    } catch (error) {
      return fromError('labBuilder.duplicateDraft', error, 'LAB_BUILDER_DUPLICATE_FAILED')
    }
  })

  ipcMain.handle('labBuilder:validateDraft', async (_event, draftId) => {
    gateLabBuilder()
    try {
      return ok(labBuilderManager.getDraft(draftId))
    } catch (error) {
      return fromError('labBuilder.validateDraft', error, 'LAB_BUILDER_VALIDATE_FAILED')
    }
  })

  ipcMain.handle('labBuilder:analyzeDraft', async (_event, draftId) => {
    gateLabBuilder()
    try {
      return ok(labBuilderManager.getDraft(draftId))
    } catch (error) {
      return fromError('labBuilder.analyzeDraft', error, 'LAB_BUILDER_ANALYZE_FAILED')
    }
  })

  ipcMain.handle('labBuilder:templateList', async () => {
    gateLabBuilder()
    return ok(Object.keys(DOCKER_TEMPLATES))
  })

  ipcMain.handle('labBuilder:applyTemplate', async (_event, draftId, presetKey) => {
    gateLabBuilder()
    try {
      return ok(labBuilderManager.applyTemplateToDraft(draftId, presetKey))
    } catch (error) {
      return fromError('labBuilder.applyTemplate', error, 'LAB_BUILDER_TEMPLATE_FAILED')
    }
  })

  ipcMain.handle('labBuilder:generateReadme', async (_event, draftId) => {
    gateLabBuilder()
    try {
      return ok({ readme: labBuilderManager.regenerateReadmeForDraft(draftId) })
    } catch (error) {
      return fromError('labBuilder.generateReadme', error, 'LAB_BUILDER_README_FAILED')
    }
  })

  ipcMain.handle('labBuilder:importAssets', async (_event, payload) => {
    gateLabBuilder()
    const draftId = payload?.draftId
    if (!draftId) return fail('INVALID', 'draftId required')
    const win = BrowserWindow.getFocusedWindow() ?? mainWindowRef
    const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
      properties: ['openFile', 'openDirectory', 'multiSelections']
    })
    if (canceled || !filePaths?.length) return fail('CANCELLED', 'Import cancelled')
    try {
      return ok(
        labBuilderManager.importAssetsToDraft(draftId, {
          filePaths,
          destPath: payload?.destPath ?? '/tmp/import',
          scope: payload?.scope,
          stage: payload?.stage,
          renderVariables: payload?.renderVariables !== false
        })
      )
    } catch (error) {
      return fromError('labBuilder.importAssets', error, 'LAB_BUILDER_IMPORT_ASSETS_FAILED')
    }
  })

  ipcMain.handle('labBuilder:importLabFolder', async () => {
    gateLabBuilder()
    const win = BrowserWindow.getFocusedWindow() ?? mainWindowRef
    const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
      properties: ['openDirectory']
    })
    if (canceled || !filePaths?.[0]) return fail('CANCELLED', 'Import cancelled')
    try {
      return ok(labBuilderManager.importDraftFromFolder(filePaths[0]))
    } catch (error) {
      return fromError('labBuilder.importLabFolder', error, 'LAB_BUILDER_IMPORT_FAILED')
    }
  })

  ipcMain.handle('labBuilder:exportDraft', async (_event, opts) => {
    gateLabBuilder()
    if (!opts?.draftId) return fail('INVALID', 'draftId required')
    const format = opts?.format === 'zip' ? 'zip' : 'folder'
    const win = BrowserWindow.getFocusedWindow() ?? mainWindowRef
    try {
      if (format === 'zip') {
        const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
          defaultPath: 'lab-export.zip',
          filters: [{ name: 'Zip archive', extensions: ['zip'] }]
        })
        if (canceled || !filePath) return fail('CANCELLED', 'Export cancelled')
        return ok(labBuilderManager.exportDraftToDisk(opts.draftId, filePath, 'zip'))
      }
      const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
        properties: ['openDirectory', 'createDirectory']
      })
      if (canceled || !filePaths?.[0]) return fail('CANCELLED', 'Export cancelled')
      return ok(labBuilderManager.exportDraftToDisk(opts.draftId, filePaths[0], 'folder'))
    } catch (error) {
      return fromError('labBuilder.exportDraft', error, 'LAB_BUILDER_EXPORT_FAILED')
    }
  })

  ipcMain.handle('labBuilder:publishDraft', async (_event, opts) => {
    gateLabBuilder()
    if (!opts?.draftId) return fail('INVALID', 'draftId required')
    try {
      const result = await labBuilderManager.publishDraftToRegistry(opts.draftId, opts?.changelog ?? '')
      return ok(result)
    } catch (error) {
      return fromError('labBuilder.publishDraft', error, 'LAB_BUILDER_PUBLISH_FAILED')
    }
  })

  ipcMain.handle('labBuilder:previewDraft', async (_event, draftId) => {
    try {
      assertDeveloperMode()
      return ok(labBuilderManager.previewDraftById(draftId))
    } catch (error) {
      return fromError('labBuilder.previewDraft', error, 'LAB_BUILDER_PREVIEW_FAILED')
    }
  })

  ipcMain.handle('labBuilder:previewLab', async (_event, payload) => {
    try {
      assertDeveloperMode()
      const lab = payload?.lab ?? null
      if (!lab || typeof lab !== 'object') {
        return fail('INVALID_PAYLOAD', 'lab object required')
      }
      const settings = getAllSettings()
      return ok(
        labBuilderManager.previewDraftLab(lab, {
          redactSecrets: settings.developerMode !== true,
          dockerfile: payload.dockerfile,
          entrypoint: payload.entrypointSh,
          validateSh: payload.validateSh,
          readme: payload.readme
        })
      )
    } catch (error) {
      return fromError('labBuilder.previewLab', error, 'LAB_BUILDER_PREVIEW_FAILED')
    }
  })

  ipcMain.handle('labBuilder:applyMockWebsite', async (_event, draftId) => {
    try {
      assertDeveloperMode()
      return ok(labBuilderManager.applyMockWebsiteToDraft(draftId))
    } catch (error) {
      return fromError('labBuilder.applyMockWebsite', error, 'LAB_BUILDER_TEMPLATE_FAILED')
    }
  })

  ipcMain.handle('labBuilder:buildTestDraft', async (_event, draftId) => {
    gateLabBuilder()
    try {
      return ok(await labBuilderManager.buildTestDraft(draftId))
    } catch (error) {
      return fromError('labBuilder.buildTestDraft', error, 'LAB_BUILDER_TEST_FAILED')
    }
  })

  ipcMain.handle('labBuilder:stopTestSession', async (_event, sessionId) => {
    gateLabBuilder()
    try {
      return ok(labBuilderManager.stopDraftTest(sessionId))
    } catch (error) {
      return fromError('labBuilder.stopTestSession', error, 'LAB_BUILDER_STOP_FAILED')
    }
  })

  registerOnlineHandlers()

  logger.info('ipc', 'Handlers registered')
}

/**
 * Phase 3 bootstrap — call once before creating windows.
 */
export function bootstrapMainServices() {
  ensureDataDirectories()
  initDatabase()
  migrateFromLegacyProfile()
  logResolvedPaths()
  const settings = getAllSettings()
  logger.info(
    'startup',
    `onboardingCompleted=${settings.onboardingCompleted === true} disclaimerAccepted=${settings.disclaimerAccepted === true}`
  )
  registerIpcHandlers()
  registerActiveSessionIdsProvider(() => labManager.getActiveSessionIds())
  void scanStaleManagedLabResources().catch((error) => {
    logger.warn('labCleanup', 'Startup stale resource scan failed', {
      error: error instanceof Error ? error.message : String(error)
    })
  })
}

export function shutdownMainServices() {
  closeAllLabTerminalWindows()
  detachAllTerminals()
  closeDatabase()
}

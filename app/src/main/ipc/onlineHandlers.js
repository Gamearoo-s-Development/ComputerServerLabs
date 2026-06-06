/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ipcMain } from 'electron'
import { ok, fromError } from './response.js'
import { ensureOnlineSessionFresh, getOnlineStatus, logoutOnline } from '../online/onlineApiClient.js'
import {
  cancelDeviceLink,
  openDeviceVerificationUrl,
  pollDeviceLink,
  startDeviceLink,
  unlinkAccount,
  updateOnlinePreferences
} from '../online/onlineAuthManager.js'
import {
  getNotificationPreferences,
  getPasswordResetWebsiteUrl,
  requestPasswordResetEmail,
  resendVerificationEmail,
  revokeRemoteSessions,
  updateNotificationPreferences
} from '../online/onlineNotificationManager.js'
import {
  browseOnlineLabs,
  downloadAndInstallLab,
  getOnlineLabDetail,
  listInstalledOnlineLabs,
  reportOnlineLab,
  uninstallRegistryLab
} from '../online/onlineLabRegistry.js'
import {
  fetchCloudAchievements,
  fetchCloudProgress,
  fetchGlobalLeaderboard,
  fetchLabLeaderboard,
  syncProgressToCloud,
  syncProgressToCloudIfLinked
} from '../online/onlineProgressSync.js'
import { logger } from '../utils/logger.js'

export function registerOnlineHandlers() {
  ipcMain.handle('online:getStatus', async () => {
    try {
      await ensureOnlineSessionFresh()
      return ok(getOnlineStatus())
    } catch (error) {
      return fromError('online.getStatus', error, 'ONLINE_STATUS_FAILED')
    }
  })

  ipcMain.handle('online:deviceLinkStart', async () => {
    try {
      const session = await startDeviceLink()
      return ok(session)
    } catch (error) {
      return fromError('online.deviceLinkStart', error, 'DEVICE_LINK_START_FAILED')
    }
  })

  ipcMain.handle('online:deviceLinkPoll', async (_event, payload) => {
    try {
      const { deviceCode, pollIntervalSec } = payload ?? {}
      const result = await pollDeviceLink(deviceCode, { pollIntervalSec })
      return ok(result)
    } catch (error) {
      return fromError('online.deviceLinkPoll', error, 'DEVICE_LINK_POLL_FAILED')
    }
  })

  ipcMain.handle('online:deviceLinkCancel', async (_event, deviceCode) => {
    cancelDeviceLink(deviceCode)
    return ok({ cancelled: true })
  })

  ipcMain.handle('online:openVerificationUrl', async (_event, url) => {
    openDeviceVerificationUrl(url)
    return ok({ opened: true })
  })

  ipcMain.handle('online:unlink', async () => {
    try {
      await logoutOnline()
      await unlinkAccount()
      return ok({ unlinked: true })
    } catch (error) {
      return fromError('online.unlink', error, 'ONLINE_UNLINK_FAILED')
    }
  })

  ipcMain.handle('online:updatePreferences', async (_event, partial) => {
    try {
      const prefs = await updateOnlinePreferences(partial ?? {})
      return ok(prefs)
    } catch (error) {
      return fromError('online.updatePreferences', error, 'ONLINE_PREFS_FAILED')
    }
  })

  ipcMain.handle('online:browseLabs', async (_event, filters) => {
    try {
      return ok({ labs: await browseOnlineLabs(filters ?? {}) })
    } catch (error) {
      return fromError('online.browseLabs', error, 'ONLINE_BROWSE_FAILED')
    }
  })

  ipcMain.handle('online:getLab', async (_event, labId) => {
    try {
      return ok(await getOnlineLabDetail(labId))
    } catch (error) {
      return fromError('online.getLab', error, 'ONLINE_LAB_FAILED')
    }
  })

  ipcMain.handle('online:downloadLab', async (_event, payload) => {
    try {
      const { labId, confirmUnverified } = payload ?? {}
      const result = await downloadAndInstallLab(labId, { confirmUnverified: confirmUnverified === true })
      return ok(result)
    } catch (error) {
      return fromError('online.downloadLab', error, 'ONLINE_DOWNLOAD_FAILED')
    }
  })

  ipcMain.handle('online:listInstalled', async () => {
    try {
      return ok({ labs: listInstalledOnlineLabs() })
    } catch (error) {
      return fromError('online.listInstalled', error, 'ONLINE_INSTALLED_FAILED')
    }
  })

  ipcMain.handle('online:uninstallLab', async (_event, labId) => {
    try {
      return ok(await uninstallRegistryLab(labId))
    } catch (error) {
      return fromError('online.uninstallLab', error, 'ONLINE_UNINSTALL_FAILED')
    }
  })

  ipcMain.handle('online:reportLab', async (_event, payload) => {
    try {
      const { labId, reason, details } = payload ?? {}
      await reportOnlineLab(labId, reason, details)
      return ok({ reported: true })
    } catch (error) {
      return fromError('online.reportLab', error, 'ONLINE_REPORT_FAILED')
    }
  })

  ipcMain.handle('online:syncProgress', async () => {
    try {
      const result = await syncProgressToCloud()
      return ok(result)
    } catch (error) {
      return fromError('online.syncProgress', error, 'ONLINE_SYNC_FAILED')
    }
  })

  ipcMain.handle('online:getCloudProgress', async () => {
    try {
      return ok({ progress: await fetchCloudProgress() })
    } catch (error) {
      return fromError('online.getCloudProgress', error, 'ONLINE_CLOUD_PROGRESS_FAILED')
    }
  })

  ipcMain.handle('online:getCloudAchievements', async () => {
    try {
      return ok({ achievements: await fetchCloudAchievements() })
    } catch (error) {
      return fromError('online.getCloudAchievements', error, 'ONLINE_CLOUD_ACHIEVEMENTS_FAILED')
    }
  })

  ipcMain.handle('online:globalLeaderboard', async () => {
    try {
      return ok({ entries: await fetchGlobalLeaderboard() })
    } catch (error) {
      return fromError('online.globalLeaderboard', error, 'ONLINE_LEADERBOARD_FAILED')
    }
  })

  ipcMain.handle('online:labLeaderboard', async (_event, labId) => {
    try {
      return ok({ entries: await fetchLabLeaderboard(labId) })
    } catch (error) {
      return fromError('online.labLeaderboard', error, 'ONLINE_LAB_LEADERBOARD_FAILED')
    }
  })

  ipcMain.handle('online:getNotificationPreferences', async () => {
    try {
      return ok({ preferences: await getNotificationPreferences() })
    } catch (error) {
      return fromError('online.getNotificationPreferences', error, 'ONLINE_NOTIF_PREFS_FAILED')
    }
  })

  ipcMain.handle('online:updateNotificationPreferences', async (_event, preferences) => {
    try {
      await updateNotificationPreferences(preferences ?? {})
      return ok({ updated: true })
    } catch (error) {
      return fromError('online.updateNotificationPreferences', error, 'ONLINE_NOTIF_PREFS_FAILED')
    }
  })

  ipcMain.handle('online:triggerNotification', async (_event, payload) => {
    try {
      const { event, context } = payload ?? {}
      if (event === 'resend_verification') {
        return ok(await resendVerificationEmail())
      }
      if (event === 'password_reset') {
        return ok(await requestPasswordResetEmail())
      }
      throw new Error(`Unsupported notification event: ${event}`)
    } catch (error) {
      return fromError('online.triggerNotification', error, 'ONLINE_NOTIF_TRIGGER_FAILED')
    }
  })

  ipcMain.handle('online:getPasswordResetUrl', async () => {
    return ok({ url: getPasswordResetWebsiteUrl() })
  })

  ipcMain.handle('online:revokeRemoteSessions', async () => {
    try {
      return ok(await revokeRemoteSessions())
    } catch (error) {
      return fromError('online.revokeRemoteSessions', error, 'ONLINE_REVOKE_FAILED')
    }
  })

  logger.info('ipc', 'Online registry handlers registered')

  void (async () => {
    try {
      await ensureOnlineSessionFresh()
      const result = await syncProgressToCloudIfLinked()
      if (result?.ok) {
        logger.info('onlineSync', 'Startup progress sync completed')
      }
    } catch (error) {
      logger.warn('onlineSync', 'Startup progress sync failed', { error: String(error) })
    }
  })()
}

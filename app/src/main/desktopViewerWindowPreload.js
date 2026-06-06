/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { contextBridge, ipcRenderer } from 'electron'

async function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args)
}

contextBridge.exposeInMainWorld('desktopViewer', {
  readClipboardText: async () => {
    const result = await invoke('app:readClipboardText')
    if (result?.ok) {
      return result?.data?.text ?? ''
    }
    return ''
  },
  writeClipboardText: async (text) => {
    const result = await invoke('app:writeClipboardText', typeof text === 'string' ? text : '')
    return result?.ok === true
  }
})

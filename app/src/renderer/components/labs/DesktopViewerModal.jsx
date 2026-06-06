/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { Button } from '../ui/index.js'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { readClipboardText, writeClipboardText } from '../../utils/clipboard.js'
import { isAllowedDesktopViewerUrl } from './desktopViewerUtils.js'
import {
  injectDesktopViewerClipboardHook,
  pasteTextIntoDesktopViewer,
  readTextFromDesktopViewer
} from './desktopViewerClipboard.js'

const isElectronRenderer = typeof window !== 'undefined' && Boolean(window.api?.version)
const CLIPBOARD_SYNC_MS = 1500

/**
 * Full-screen in-app desktop viewer (interactive noVNC embed).
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   desktopUrl?: string | null
 *   title?: string
 * }} props
 */
export default function DesktopViewerModal({
  open,
  onClose,
  desktopUrl = null,
  title = 'Lab Desktop'
}) {
  const { notify } = useNotifications()
  const webviewRef = useRef(null)
  const [shareClipboard, setShareClipboard] = useState(true)
  const lastHostClipboardRef = useRef('')
  const lastVmClipboardRef = useRef('')
  const safeUrl = isAllowedDesktopViewerUrl(desktopUrl) ? desktopUrl : null

  const setupWebviewClipboard = useCallback(async () => {
    const webview = webviewRef.current
    if (!webview) return
    await injectDesktopViewerClipboardHook(webview)
  }, [])

  useEffect(() => {
    if (!open || !isElectronRenderer || !safeUrl) return undefined
    const webview = webviewRef.current
    if (!webview) return undefined

    const onNewWindow = (event) => {
      event.preventDefault()
    }
    const onDomReady = () => {
      void setupWebviewClipboard()
    }

    webview.addEventListener('new-window', onNewWindow)
    webview.addEventListener('dom-ready', onDomReady)
    return () => {
      webview.removeEventListener('new-window', onNewWindow)
      webview.removeEventListener('dom-ready', onDomReady)
    }
  }, [open, safeUrl, setupWebviewClipboard])

  useEffect(() => {
    if (!open || !shareClipboard || !isElectronRenderer || !safeUrl) return undefined

    let cancelled = false
    const sync = async () => {
      if (cancelled) return
      const webview = webviewRef.current
      if (!webview) return

      try {
        const hostText = await readClipboardText()
        if (hostText !== lastHostClipboardRef.current) {
          lastHostClipboardRef.current = hostText
          if (hostText) {
            await pasteTextIntoDesktopViewer(webview, hostText)
          }
        }

        const vmText = await readTextFromDesktopViewer(webview)
        if (vmText && vmText !== lastVmClipboardRef.current) {
          lastVmClipboardRef.current = vmText
          if (vmText !== hostText) {
            await writeClipboardText(vmText)
            lastHostClipboardRef.current = vmText
          }
        }
      } catch {
        // ignore transient clipboard / webview errors
      }
    }

    void sync()
    const timer = setInterval(() => void sync(), CLIPBOARD_SYNC_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [open, shareClipboard, safeUrl])

  useEffect(() => {
    if (!open) {
      lastHostClipboardRef.current = ''
      lastVmClipboardRef.current = ''
    }
  }, [open])

  const handlePasteToDesktop = useCallback(async () => {
    const webview = webviewRef.current
    if (!webview) return
    try {
      const text = await readClipboardText()
      if (!text) {
        notify({ title: 'Clipboard empty', body: 'Nothing to paste into the desktop.', tone: 'info' })
        return
      }
      const ok = await pasteTextIntoDesktopViewer(webview, text)
      notify({
        title: ok ? 'Pasted to desktop' : 'Paste failed',
        body: ok
          ? 'Host clipboard sent to the desktop viewer.'
          : 'Could not reach the noVNC clipboard — wait for the viewer to finish loading.',
        tone: ok ? 'success' : 'warning'
      })
      if (ok) lastHostClipboardRef.current = text
    } catch (e) {
      notify({
        title: 'Paste failed',
        body: e instanceof Error ? e.message : 'Could not read host clipboard.',
        tone: 'danger'
      })
    }
  }, [notify])

  const handleCopyFromDesktop = useCallback(async () => {
    const webview = webviewRef.current
    if (!webview) return
    try {
      await setupWebviewClipboard()
      const text = await readTextFromDesktopViewer(webview)
      if (!text) {
        notify({
          title: 'Nothing to copy',
          body: 'Copy text inside the desktop first (Ctrl+C), then try again.',
          tone: 'info'
        })
        return
      }
      await writeClipboardText(text)
      lastHostClipboardRef.current = text
      lastVmClipboardRef.current = text
      notify({ title: 'Copied from desktop', body: 'VM clipboard copied to your system.', tone: 'success' })
    } catch (e) {
      notify({
        title: 'Copy failed',
        body: e instanceof Error ? e.message : 'Could not read desktop clipboard.',
        tone: 'danger'
      })
    }
  }, [notify, setupWebviewClipboard])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      panelClassName="flex max-h-[94vh] max-w-[min(96vw,72rem)] flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col p-4 pt-0">
        {safeUrl ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => void handlePasteToDesktop()}>
                Paste to desktop
              </Button>
              <Button variant="secondary" size="sm" type="button" onClick={() => void handleCopyFromDesktop()}>
                Copy from desktop
              </Button>
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-[11px] text-muted">
                <input
                  type="checkbox"
                  className="rounded border-border bg-background"
                  checked={shareClipboard}
                  onChange={(event) => setShareClipboard(event.target.checked)}
                />
                Share clipboard
              </label>
            </div>
            <div className="relative min-h-[min(78vh,42rem)] flex-1 overflow-hidden rounded-lg border border-border bg-[#0057d8]">
              {isElectronRenderer ? (
                // eslint-disable-next-line react/no-unknown-property -- Electron webview tag
                <webview
                  ref={webviewRef}
                  src={safeUrl}
                  className="absolute inset-0 h-full w-full"
                  partition="persist:lab-desktop-viewer"
                  allowpopups={false}
                />
              ) : (
                <iframe
                  src={safeUrl}
                  title={title}
                  className="absolute inset-0 h-full w-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
                />
              )}
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted">
            Desktop viewer is not available yet. Wait for Windows to finish starting, then try again.
          </p>
        )}
        <p className="mt-3 text-[11px] text-muted-dim">
          {shareClipboard
            ? 'Shared clipboard keeps host and desktop in sync while this viewer is open.'
            : 'Use Paste to desktop / Copy from desktop for manual clipboard transfer.'}{' '}
          Close when finished — your lab session stays active.
        </p>
      </div>
    </Modal>
  )
}

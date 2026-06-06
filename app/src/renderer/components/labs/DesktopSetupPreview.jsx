/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/cn.js'
import { isAllowedDesktopViewerUrl } from './desktopViewerUtils.js'

const isElectronRenderer = typeof window !== 'undefined' && Boolean(window.api?.version)

const PREVIEW_VIEWER_CSS = `
  html, body {
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
    pointer-events: none !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    width: 100% !important;
    height: 100% !important;
  }
  ::-webkit-scrollbar {
    display: none !important;
  }
`

/**
 * @param {string | null | undefined} url
 */
function isAllowedDesktopPreviewUrl(url) {
  return isAllowedDesktopViewerUrl(url)
}

/**
 * @param {import('electron').WebviewTag} webview
 */
async function fitPreviewToWebview(webview) {
  const width = webview.clientWidth
  const height = webview.clientHeight
  if (!width || !height) return

  try {
    await webview.insertCSS(PREVIEW_VIEWER_CSS)
    await webview.executeJavaScript(
      `(function () {
        const doc = document.documentElement
        const body = document.body
        const contentW = Math.max(
          doc.scrollWidth,
          doc.offsetWidth,
          body.scrollWidth,
          body.offsetWidth,
          1
        )
        const contentH = Math.max(
          doc.scrollHeight,
          doc.offsetHeight,
          body.scrollHeight,
          body.offsetHeight,
          1
        )
        const scale = Math.min(${width} / contentW, ${height} / contentH, 1)
        body.style.zoom = String(scale)
        body.style.transformOrigin = 'top left'
        doc.style.overflow = 'hidden'
        body.style.overflow = 'hidden'
        return scale
      })()`,
      true
    )
  } catch {
    // ignore — preview still usable at default scale
  }
}

/**
 * Non-interactive embedded preview of desktop workstation setup (viewer + log tail).
 * @param {{
 *   desktopUrl?: string | null
 *   setupLogTail?: string[]
 *   className?: string
 * }} props
 */
export default function DesktopSetupPreview({
  desktopUrl = null,
  setupLogTail = [],
  className
}) {
  const webviewRef = useRef(null)
  const frameRef = useRef(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const safeUrl = isAllowedDesktopPreviewUrl(desktopUrl) ? desktopUrl : null
  const showEmbed = Boolean(safeUrl) && !previewFailed
  const showLogs = !showEmbed && setupLogTail.length > 0

  const refitPreview = useCallback(() => {
    const webview = webviewRef.current
    if (!webview) return
    void fitPreviewToWebview(webview)
  }, [])

  useEffect(() => {
    setPreviewFailed(false)
  }, [safeUrl])

  useEffect(() => {
    if (!isElectronRenderer || !safeUrl || previewFailed) return undefined
    const webview = webviewRef.current
    if (!webview) return undefined

    const onDomReady = () => {
      void fitPreviewToWebview(webview)
    }
    const onFail = () => setPreviewFailed(true)
    const onNewWindow = (event) => {
      event.preventDefault()
    }

    webview.addEventListener('dom-ready', onDomReady)
    webview.addEventListener('did-finish-load', onDomReady)
    webview.addEventListener('did-fail-load', onFail)
    webview.addEventListener('new-window', onNewWindow)
    return () => {
      webview.removeEventListener('dom-ready', onDomReady)
      webview.removeEventListener('did-finish-load', onDomReady)
      webview.removeEventListener('did-fail-load', onFail)
      webview.removeEventListener('new-window', onNewWindow)
    }
  }, [safeUrl, previewFailed])

  useEffect(() => {
    if (!showEmbed || !frameRef.current) return undefined
    const frame = frameRef.current
    const observer = new ResizeObserver(() => refitPreview())
    observer.observe(frame)
    return () => observer.disconnect()
  }, [showEmbed, refitPreview])

  if (!showEmbed && !showLogs) return null

  return (
    <div className={cn('space-y-2', className)}>
      <p className="sr-only">Setup preview (view only)</p>

      {showEmbed ? (
        <div
          ref={frameRef}
          className="relative isolate h-[min(52vh,18rem)] w-full overflow-hidden rounded-lg border border-border bg-[#0057d8] [contain:strict]"
        >
          {isElectronRenderer ? (
            // eslint-disable-next-line react/no-unknown-property -- Electron webview tag
            <webview
              ref={webviewRef}
              src={safeUrl}
              className="absolute inset-0 block h-full w-full"
              style={{ display: 'flex' }}
              partition="persist:desktop-setup-preview"
              allowpopups={false}
            />
          ) : (
            <>
              <div className="absolute inset-0 z-10 cursor-default" aria-hidden />
              <iframe
                src={safeUrl}
                title="Desktop setup preview"
                className="pointer-events-none absolute inset-0 h-full w-full origin-top-left border-0"
                sandbox="allow-scripts allow-same-origin"
              />
            </>
          )}
        </div>
      ) : null}

      {showLogs ? (
        <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-background/80 p-2 font-mono text-[10px] leading-relaxed text-muted">
          {setupLogTail.map((line, index) => (
            <div key={`${index}-${line.slice(0, 24)}`} className="break-words text-gray-400">
              {line}
            </div>
          ))}
        </div>
      ) : null}

      {!showEmbed && safeUrl ? (
        <p className="text-[11px] text-muted-dim">
          Live viewer could not be embedded here. Setup logs are shown above while Windows installs.
        </p>
      ) : null}
    </div>
  )
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** Inject once per webview load to capture VM → host clipboard events from noVNC. */
export const DESKTOP_VIEWER_CLIPBOARD_HOOK = `
(function() {
  if (window.__sgqDesktopClipboardReady) return true;
  window.__sgqDesktopClipboardReady = true;
  window.__sgqVmClipboard = '';
  function findRfb() {
    return window.rfb || (window.UI && window.UI.rfb) || null;
  }
  function attach() {
    const rfb = findRfb();
    if (!rfb) {
      setTimeout(attach, 400);
      return;
    }
    rfb.addEventListener('clipboard', (event) => {
      window.__sgqVmClipboard = (event && event.detail && event.detail.text) || '';
    });
  }
  attach();
  return true;
})();
`

/**
 * @param {string} text
 */
export function buildPasteToDesktopViewerScript(text) {
  const encoded = JSON.stringify(text)
  return `(function() {
    const text = ${encoded};
    const rfb = window.rfb || (window.UI && window.UI.rfb);
    if (rfb && typeof rfb.clipboardPasteFrom === 'function') {
      rfb.clipboardPasteFrom(text);
      return true;
    }
    const textarea = document.getElementById('noVNC_clipboard_text');
    if (textarea) {
      textarea.value = text;
      return true;
    }
    return false;
  })()`
}

export const READ_DESKTOP_VIEWER_CLIPBOARD_SCRIPT = `window.__sgqVmClipboard || ''`

/**
 * @param {import('electron').WebviewTag | null | undefined} webview
 */
export async function injectDesktopViewerClipboardHook(webview) {
  if (!webview?.executeJavaScript) return false
  try {
    return (await webview.executeJavaScript(DESKTOP_VIEWER_CLIPBOARD_HOOK, true)) === true
  } catch {
    return false
  }
}

/**
 * @param {import('electron').WebviewTag | null | undefined} webview
 * @param {string} text
 */
export async function pasteTextIntoDesktopViewer(webview, text) {
  if (!webview?.executeJavaScript || !text) return false
  try {
    return (await webview.executeJavaScript(buildPasteToDesktopViewerScript(text), true)) === true
  } catch {
    return false
  }
}

/**
 * @param {import('electron').WebviewTag | null | undefined} webview
 */
export async function readTextFromDesktopViewer(webview) {
  if (!webview?.executeJavaScript) return ''
  try {
    const text = await webview.executeJavaScript(READ_DESKTOP_VIEWER_CLIPBOARD_SCRIPT, true)
    return typeof text === 'string' ? text : ''
  } catch {
    return ''
  }
}

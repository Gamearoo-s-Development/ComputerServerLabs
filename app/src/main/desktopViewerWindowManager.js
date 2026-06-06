/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { BrowserWindow } from 'electron'

/**
 * @param {string} url
 */
function assertAllowedDesktopViewerUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Desktop URL is required.')
  }
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Desktop URL is invalid.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Desktop URL protocol is not allowed.')
  }
  const host = parsed.hostname.toLowerCase()
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1' && host !== '[::1]') {
    throw new Error('Desktop URL host is not allowed.')
  }
}

const CLIPBOARD_HOOK_SCRIPT = `
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

function buildPasteScript(text) {
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

const READ_VM_CLIPBOARD_SCRIPT = `window.__sgqVmClipboard || ''`

/**
 * @param {string} title
 * @param {string} url
 */
function buildViewerHtml(title, url) {
  const safeTitle = JSON.stringify(title)
  const safeUrl = JSON.stringify(url)
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src *; frame-src http: https:;" />
    <title>${title}</title>
    <style>
      :root{
        --bg:#0b1020; --panel:#11172a; --panel2:#0f1628; --text:#e5e7eb; --muted:#9ca3af;
        --border:#27324a; --accent:#34d1ff; --btn:#1a243a; --btn2:#0f172a;
      }
      *{box-sizing:border-box}
      body{margin:0;font-family:Inter,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text)}
      .root{display:flex;flex-direction:column;height:100vh;width:100vw}
      .top{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,var(--panel),var(--panel2))}
      .title{font-size:14px;font-weight:600;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .spacer{flex:1}
      .btn{background:var(--btn);color:var(--text);border:1px solid var(--border);padding:6px 10px;border-radius:8px;font-size:12px;cursor:pointer}
      .btn:hover{border-color:#3a4d74}
      .btn.primary{background:rgba(52,209,255,.14);border-color:rgba(52,209,255,.4);color:#dff8ff}
      .status{font-size:11px;color:var(--muted)}
      .viewer{position:relative;flex:1;overflow:hidden;background:#0057d8}
      webview{position:absolute;inset:0;width:100%;height:100%}
      .check{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
      .check input{accent-color:#34d1ff}
    </style>
  </head>
  <body>
    <div class="root">
      <div class="top">
        <div class="title" id="title"></div>
        <button class="btn" id="pasteBtn">Paste to desktop</button>
        <button class="btn" id="copyBtn">Copy from desktop</button>
        <label class="check"><input id="syncToggle" type="checkbox" checked />Share clipboard</label>
        <div class="spacer"></div>
        <div class="status" id="status">Connecting…</div>
        <button class="btn primary" id="reloadBtn">Reload</button>
      </div>
      <div class="viewer">
        <webview id="viewer" partition="persist:lab-desktop-viewer" allowpopups="false"></webview>
      </div>
    </div>
    <script>
      const title = ${safeTitle};
      const url = ${safeUrl};
      const CLIPBOARD_SYNC_MS = 1500;
      const state = { lastHostClipboard:'', lastVmClipboard:'', stopped:false };
      const viewer = document.getElementById('viewer');
      const statusEl = document.getElementById('status');
      const syncToggle = document.getElementById('syncToggle');
      document.getElementById('title').textContent = title;
      viewer.src = url;

      function setStatus(text){ statusEl.textContent = text; }
      async function injectHook(){
        try { await viewer.executeJavaScript(${JSON.stringify(CLIPBOARD_HOOK_SCRIPT)}, true); } catch {}
      }
      async function pasteToVm(text){
        if (!text) return false;
        try { return (await viewer.executeJavaScript(buildPasteScript(text), true)) === true; } catch { return false; }
      }
      async function readVmClipboard(){
        try { const t = await viewer.executeJavaScript(${JSON.stringify(READ_VM_CLIPBOARD_SCRIPT)}, true); return typeof t === 'string' ? t : ''; } catch { return ''; }
      }
      function buildPasteScript(text){
        const encoded = JSON.stringify(text);
        return ${JSON.stringify(buildPasteScript('___TEXT___'))}.replace('"___TEXT___"', encoded);
      }

      viewer.addEventListener('dom-ready', async () => {
        setStatus('Viewer ready');
        await injectHook();
      });
      viewer.addEventListener('did-fail-load', () => setStatus('Viewer load failed'));
      viewer.addEventListener('new-window', (event) => event.preventDefault());

      document.getElementById('reloadBtn').addEventListener('click', () => viewer.reload());
      document.getElementById('pasteBtn').addEventListener('click', async () => {
        const hostText = await window.desktopViewer.readClipboardText();
        if (!hostText) { setStatus('Clipboard empty'); return; }
        const ok = await pasteToVm(hostText);
        setStatus(ok ? 'Pasted to desktop' : 'Paste failed');
        if (ok) state.lastHostClipboard = hostText;
      });
      document.getElementById('copyBtn').addEventListener('click', async () => {
        await injectHook();
        const vmText = await readVmClipboard();
        if (!vmText) { setStatus('Nothing to copy'); return; }
        await window.desktopViewer.writeClipboardText(vmText);
        state.lastVmClipboard = vmText;
        state.lastHostClipboard = vmText;
        setStatus('Copied from desktop');
      });

      async function syncClipboard(){
        if (state.stopped || !syncToggle.checked) return;
        try {
          const hostText = await window.desktopViewer.readClipboardText();
          if (hostText !== state.lastHostClipboard) {
            state.lastHostClipboard = hostText;
            if (hostText) await pasteToVm(hostText);
          }
          const vmText = await readVmClipboard();
          if (vmText && vmText !== state.lastVmClipboard) {
            state.lastVmClipboard = vmText;
            if (vmText !== hostText) {
              await window.desktopViewer.writeClipboardText(vmText);
              state.lastHostClipboard = vmText;
            }
          }
        } catch {}
      }
      const timer = setInterval(syncClipboard, CLIPBOARD_SYNC_MS);
      window.addEventListener('beforeunload', () => { state.stopped = true; clearInterval(timer); });
    </script>
  </body>
</html>`
}

/** @type {Map<string, BrowserWindow>} */
const viewerWindowsBySession = new Map()

/**
 * Open desktop viewer in a dedicated app window.
 * @param {{ url: string, title?: string }} params
 */
export async function openDesktopViewerWindow(params) {
  const url = params?.url
  const title = params?.title && typeof params.title === 'string' ? params.title : 'Windows Desktop Workstation'
  const sessionId =
    params?.sessionId && typeof params.sessionId === 'string' ? params.sessionId.trim() : null
  assertAllowedDesktopViewerUrl(url)

  if (sessionId && viewerWindowsBySession.has(sessionId)) {
    const existing = viewerWindowsBySession.get(sessionId)
    if (existing && !existing.isDestroyed()) {
      existing.focus()
      return { opened: true, reused: true }
    }
    viewerWindowsBySession.delete(sessionId)
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    autoHideMenuBar: true,
    title,
    backgroundColor: '#0b1020',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
      preload: new URL('./desktopViewerWindowPreload.js', import.meta.url).pathname
    }
  })

  if (sessionId) {
    viewerWindowsBySession.set(sessionId, win)
  }
  win.once('closed', () => {
    if (!sessionId) return
    const tracked = viewerWindowsBySession.get(sessionId)
    if (tracked === win) {
      viewerWindowsBySession.delete(sessionId)
    }
  })

  const html = buildViewerHtml(title, url)
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  win.show()
  win.focus()

  return { opened: true }
}

export function closeAllDesktopViewerWindows() {
  for (const win of viewerWindowsBySession.values()) {
    try {
      if (!win.isDestroyed()) {
        win.close()
      }
    } catch {
      // best effort on shutdown
    }
  }
  viewerWindowsBySession.clear()
}

# Security hardening checklist

Use this list for releases and security reviews.

## Electron

- [ ] `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on all windows
- [ ] `webSecurity: true`, no `allowRunningInsecureContent`
- [ ] CSP in `src/renderer/index.html` (no `unsafe-eval`)
- [ ] Navigation / `window.open` blocked or confirmed for external URLs
- [ ] Preload exposes only `window.api` invoke/listener wrappers

## IPC

- [ ] All mutating handlers validate IDs (`labId`, `sessionId`, `terminalId`)
- [ ] Settings/profile patches use AJV with `additionalProperties: false`
- [ ] Terminal write capped (32 KiB); debug logs behind Developer Mode
- [ ] `data:resetAll` requires `confirmed: true`

## Docker

- [ ] No `--privileged`, host network, or bind mounts in managed `docker run`
- [ ] Per-session bridge network
- [ ] Memory / CPU / pids limits from `config/app.defaults.json`
- [ ] `--cap-drop ALL` + minimal `--cap-add` (includes `NET_ADMIN` / `NET_RAW` for in-container ufw/iptables labs)
- [ ] Lab targets omit `no-new-privileges` so in-container `sudo` works for training tasks; other guardrails remain
- [ ] Cleanup on quit, stop, failed start

## Labs

- [ ] `lab.json` validated against `config/lab.schema.json`
- [ ] Folder scan rejects `.js`, `.exe`, `.ps1`, symlinks
- [ ] Lab Builder gated by Developer Mode
- [ ] Dockerfile static scan in `labBuilderSafety.js`

## Data

- [ ] SQLite in userData only; `user_version` migrations
- [ ] Parameterized SQL only
- [ ] Session credential files mode `0600`

## Dependencies

- [ ] `npm run security:audit` — no high severity (see [security-electron-notes.md](security-electron-notes.md) for Electron acceptance)
- [ ] Pin `electron`, `better-sqlite3`, `node-pty`
- [ ] Windows contributors follow [windows-build.md](windows-build.md) for native rebuild

## Operations

- [ ] No passwords/tokens in logs or Discord RPC
- [ ] Community content disclaimer visible in Settings

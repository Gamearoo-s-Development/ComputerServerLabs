# Investigation: alternatives to node-pty (future)

**Status:** notes only — **do not implement yet**. Lab Terminal today uses `node-pty` + `docker exec` into the sandbox helper.

## Problem

`node-pty` is a **native addon** per Electron version and OS:

- Windows needs MSVC + Spectre-mitigated libs when prebuilds are missing  
- Paths with spaces break node-gyp  
- `electron-rebuild` adds friction for contributors  

## Current architecture (keep)

```text
Renderer (xterm) → IPC → Main (node-pty) → docker exec → helper container → su → lab user
```

Strengths: familiar PTY semantics, works with existing helper SSH workflow.

## Option A — xterm + WebSocket bridge

Run a small **PTY broker** inside the helper container (or a sidecar) that exposes a WebSocket (e.g. `ttyd`, `wetty`, custom Node server with `node-pty` **inside Linux only**).

| Pros | Cons |
|------|------|
| No Windows native PTY in Electron | New network surface; must bind localhost only |
| Rebuild pain moves to Linux Docker image | Auth/token between main and broker |
| xterm.js already in renderer | More moving parts |

## Option B — container-only PTY (docker attach)

Use `docker attach` / `docker exec -it` stream parsed in main without node-pty on Windows.

| Pros | Cons |
|------|------|
| Drop node-pty from Electron app | Weaker TTY/resize semantics; Windows Docker CLI quirks |
| | Still subprocess management on host |

## Option C — keep node-pty, improve DX only

- Prebuild-first install (done in `scripts/rebuild-native.mjs`)  
- Document VS components (`docs/windows-build.md`)  
- CI prebuild/cache artifacts  

Lowest risk; matches current product.

## Recommendation (2026)

**Short term:** Option C — keep node-pty, harden install/docs (this repo).  
**Medium term:** Prototype Option A with PTY broker **inside** `terminal-helper` image so host only speaks HTTP/WebSocket to `127.0.0.1`.  
**Not recommended:** Option B as primary UX on Windows.

## Acceptance criteria for any replacement

- No host shell from renderer  
- Session-scoped; dies when lab stops
- Resize, colors, Ctrl+C behave like today  
- No new high ports on `0.0.0.0`  
- Packaged app works on Windows without Spectre libs on **end users** (dev build may still need them)

## References

- [node-pty](https://github.com/microsoft/node-pty)  
- [@electron/rebuild](https://github.com/electron/rebuild)  
- [xterm.js](https://xtermjs.org/)  
- Internal: `src/main/terminalManager.js`, `labs/_shared/terminal-helper/`

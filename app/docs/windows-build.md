# Windows build setup

Computer Server Labs uses **native Node addons** (`better-sqlite3`, `node-pty`) that must match your **Electron** version. On Windows this usually means either downloading a **prebuilt binary** or compiling with **Visual Studio**.

## Recommended clone path

**Avoid spaces and `&` in the folder path.** node-gyp and MSVC are known to break paths like:

```text
C:\Users\You\Documents\GitHub\Computer Server Labs   ← problematic (spaces)
```

Prefer:

```text
C:\Dev\SysAdminGame
C:\src\sysadmin-game-quizes
```

## Quick checklist

| Requirement | Visual Studio Installer |
|-------------|-------------------------|
| C++ toolchain | Workload: **Desktop development with C++** |
| Compiler | **MSVC v143** (VS 2022) or **MSVC v180** (VS 2026) – x64/x86 build tools |
| SDK | **Windows 10** or **Windows 11 SDK** |
| Spectre libs (fixes MSB8040) | **MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libs (Latest)** |
| node-gyp helper | **Python 3** (3.10+), on PATH |
| Optional | **CMake** (individual component) |

## Step-by-step: Visual Studio Installer

1. Install [Visual Studio 2022](https://visualstudio.microsoft.com/vs/) or [Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Community is fine).
2. Open **Visual Studio Installer** → **Modify** on your installation.
3. **Workloads** tab → enable **Desktop development with C++**.
4. **Individual components** tab → search and enable:
   - `MSVC v143 - VS 2022 C++ x64/x86 build tools` (or v180 for VS 2026)
   - `MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libs (Latest)`  
     ← this fixes error **MSB8040: Spectre-mitigated libraries are required**
   - `Windows 11 SDK` (or Windows 10 SDK)
   - `Python development` is not required; install [Python 3](https://www.python.org/downloads/) separately and check **Add to PATH**.
5. Click **Modify** and wait for install to finish.
6. Restart the terminal (and Cursor/VS Code).

### Screenshot placeholders

Add screenshots under `docs/images/windows-build/` when available:

| File | Content |
|------|---------|
| `01-installer-workloads.png` | Desktop development with C++ checked |
| `02-spectre-component.png` | Spectre-mitigated libs component highlighted |
| `03-python-path.png` | `python --version` in PowerShell |

## Install project dependencies

```powershell
cd C:\Dev\SysAdminGame
npm install
```

`postinstall` runs `scripts/rebuild-native.mjs`, which:

1. Warns if the path contains spaces  
2. Tries **prebuild-install** for Electron (no compile when a prebuild exists)  
3. Runs **@electron/rebuild** without forcing recompile unless you pass `--force`

### If install still fails

```powershell
npm run rebuild:native
```

Force a full recompile (slower):

```powershell
npm run rebuild:native:force
```

Read the printed banner — it names the exact Spectre component if MSB8040 appears.

## Common errors

### MSB8040 — Spectre-mitigated libraries are required

**Fix:** Install the Spectre-mitigated MSVC libraries (see checklist above). This is the most common `node-pty` / `electron-rebuild` failure on Windows.

### `'Quizes\node_modules\.bin\' is not recognized`

**Cause:** Spaces in the repo path break `.cmd` shims.  
**Fix:** Move the repo to a path without spaces and run `npm install` again.

### node-gyp / Python not found

**Fix:** Install Python 3, ensure `python --version` works in PowerShell, then:

```powershell
npm config set python python
```

### Prebuild vs local compile

| Module | Prebuild for Electron? | If missing |
|--------|------------------------|------------|
| `better-sqlite3` | No for Electron 42 (see matrix below) | Compiles with VS + Spectre libs |
| `node-pty` | Sometimes | Always needs VS + Spectre libs on Windows |

## Electron / native module compatibility matrix

Pinned versions in `package.json`. Rebuild with `npm run rebuild:native` after changing Electron or native deps.

| Component | Pinned version | Notes |
|-----------|----------------|-------|
| Electron | `42.3.0` | Audit-patched line; ships Node ≥ 22.12 |
| `@electron/rebuild` | `4.0.4` | Used by `scripts/rebuild-native.mjs` and `postinstall` |
| `better-sqlite3` | `12.10.0` | Latest npm release; upstream [rolled back Electron 42 prebuilds](https://github.com/WiseLibs/better-sqlite3/pull/1470) until V8 API fixes land |
| `better-sqlite3` patch | `patches/better-sqlite3+12.10.0.patch` | Applies [PR #1475](https://github.com/WiseLibs/better-sqlite3/pull/1475) (V8 `External` + `SetNativeDataProperty` for Electron 42). Remove when a release includes that fix. |
| `patch-package` | `8.0.1` | Applies the patch on `npm install` before native rebuild |
| `node-pty` | `1.1.0` | No Electron 42 prebuild on Windows; compile from source |
| Preload bundle | `out/preload/preload.cjs` | **CJS** output (not `.mjs`) — sandboxed preload cannot use top-level ESM `import` on Electron 42 |

**Install flow:** `npm install` → `patch-package` → `rebuild-native.mjs` (prebuild attempt, then `@electron/rebuild`).

**Verify native modules:**

```powershell
npm run rebuild:native
# expect: Native modules ready for Electron 42.3.0
```

## Verify

```powershell
npm run lint
npm run dev
```

In the app: start a lab → **Open Lab Terminal**. If PTY loaded, native rebuild succeeded.

## Related docs

- [security-electron-notes.md](security-electron-notes.md) — pinned Electron version and mitigations  
- [docker-setup.md](docker-setup.md) — Docker for labs
- [investigations/node-pty-alternatives.md](investigations/node-pty-alternatives.md) — future terminal architecture

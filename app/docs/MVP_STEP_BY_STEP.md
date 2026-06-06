# MVP Step-by-Step Build Checklist

This document is the **hands-on build order** for [Computer Server Labs](../README.md). Work through each phase in sequence. Check off items as you complete them.

**Goals for the MVP**

- Real Docker labs (not a fake simulator)
- Windows 10/11 and Linux desktop support (no macOS yet)
- One fully working lab (`beginner-linux-001`) plus four scaffolded starter labs
- SQLite progress, XP, hints, and validation
- Optional Discord Rich Presence (privacy-friendly, off if Discord is unavailable)

**Stack reference**

- Electron + React + Tailwind (electron-vite recommended)
- Node.js main process, Docker CLI via `child_process`
- SQLite (`better-sqlite3`) for progress
- `electron-builder` for Windows NSIS and Linux AppImage/deb
- License: [MPL-2.0](../LICENSE)

---

## How to use this checklist

1. Complete **Phase 1** before moving on.
2. Phases 2–8 can overlap slightly (e.g. stub IPC while building UI), but **do not skip** security or validation steps.
3. **Phase 10** is the MVP gate — do not call the MVP done until `beginner-linux-001` works end-to-end.
4. Use **Phase 13** as the final acceptance test on both Windows and Linux.
5. Read **System Safety and Anti-Bricking Rules** below before implementing Docker, labs, or validation (Phases 4–7).

---

## System Safety and Anti-Bricking Rules

These rules are **mandatory** for all MVP and post-MVP work. They protect users from accidental damage to their real machines.

### Host and system boundaries

- The app must **never** run destructive commands on the host OS.
- The app must **never** modify the user’s real system outside the application data folder (e.g. Electron `userData`, local SQLite, and user settings JSON).
- **Labs must run inside Docker containers only** for the MVP (no host-level lab execution).
- Do **not** mount host folders into containers unless a lab explicitly requires it **and** the user confirms.
- **Never** use privileged Docker containers (`--privileged`) by default.
- **Never** run host commands such as: `rm -rf`, `diskpart`, `format`, `bcdedit`, `reg delete`, `dd`, `mkfs`, `shutdown`, `reboot`, or firewall reset.
- **Validation must run inside the lab container** (e.g. `docker exec`), not on the host.

### User-facing safety

- Clearly label lab credentials as **temporary lab-only** credentials (not production passwords).
- Show a **warning before starting a lab** that explains the environment is isolated and fictional credentials are for training only.
- Show a **warning** if any future lab requests elevated permissions, host mounts, or privileged mode.
- Add **confirmation dialogs** before reset, destroy, or other irreversible lab actions.

### Documentation

- Document what the app **can** and **cannot** change ([docs/security-model.md](security-model.md), [SECURITY.md](../SECURITY.md)).
- Contributors must follow these rules when adding labs ([docs/creating-labs.md](creating-labs.md)).

### Safety Mode (default: ON)

Safety Mode is a user setting (**enabled by default**) enforced in code during lab orchestration (Phases 5–7). When enabled, the app must:

| Block | Reason |
|-------|--------|
| Privileged containers | Prevents broad host access |
| Host volume mounts | Prevents reading/writing user files |
| Host shell commands for lab/validation | Keeps checks inside containers |
| Unknown validation types | Prevents arbitrary execution |
| Labs that request unsafe capabilities | e.g. `privileged`, `hostNetwork`, bind mounts without approval |

Disabling Safety Mode (if offered later) must require explicit user consent and a clear risk warning.

### Checklist for lab/validation PRs

- [ ] No host destructive commands
- [ ] Validation runs via `docker exec` only
- [ ] `lab.json` validated against schema; no arbitrary shell from user input
- [ ] Credentials described as lab-only in lab README
- [ ] Host mounts and privileged flags absent or gated behind confirmation + Safety Mode off

---

## Phase 1: Scaffold project

Establish the repository layout and tooling.

- [x] Create root `package.json` with name `sysadmin-game-quizes`, version `0.1.0` (do not bump for releases unless requested)
- [x] Add scripts: `dev`, `start`, `build`, `package:win`, `package:linux`, `lint`
- [x] Initialize **electron-vite** (or equivalent) with three targets: `main`, `preload`, `renderer`
- [x] Create folder structure:

  ```text
  src/main/
  src/renderer/
  labs/
  docs/
  config/
  assets/
  database/          # runtime DB (gitignored)
  .github/
  ```

- [x] Add MPL-2.0 Exhibit A header comment to all new `src/**/*.js` and `src/**/*.jsx` files
- [x] Configure Tailwind + PostCSS for the renderer
- [x] Add ESLint (and optional Prettier) with `npm run lint`
- [x] Extend [`.gitignore`](../.gitignore): `dist/`, `release/`, `node_modules/`, `database/*.db`, `.env`
- [x] Add `config/app.defaults.json` for non-secret defaults (XP rules, hint penalty, unlock thresholds)
- [x] Add placeholder app icon under `assets/` for later packaging
- [x] Verify `npm install` and `npm run dev` open an empty Electron window

**Done when:** Dev server runs; main/preload/renderer compile without errors.

---

## Phase 2: Open-source docs

Make the project contributor-ready before feature code grows.

- [x] Expand [README.md](../README.md): overview, features, screenshots placeholder, install, dev setup, labs overview, packaging, license/MPL notes, **Discord Rich Presence**, **Safety Mode** / anti-bricking summary
- [x] Create [CONTRIBUTING.md](../CONTRIBUTING.md): dev setup, coding standards, lab contributions, PR checklist, testing, link to safety rules
- [x] Create [SECURITY.md](../SECURITY.md): supported versions, vulnerability reporting, sandbox boundaries, what the app cannot change
- [x] Create [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)
- [x] Add `.github/ISSUE_TEMPLATE/bug_report.md`
- [x] Add `.github/ISSUE_TEMPLATE/feature_request.md`
- [x] Add `.github/ISSUE_TEMPLATE/lab_submission.md`
- [x] Add `.github/pull_request_template.md`
- [x] Create full docs (not stubs):
  - [x] `docs/architecture.md` — modules, data flow, future VM placeholders
  - [x] `docs/creating-labs.md` — lab.json, Dockerfile, validation, safety requirements
  - [x] `docs/docker-setup.md` — Windows/Linux Docker install and verify
  - [x] `docs/security-model.md` — Safety Mode, boundaries, validation rules, anti-bricking

**Done when:** A new contributor can read README + CONTRIBUTING + security-model and know how to clone, install, contribute safely, and open a PR.

**Do not start Phase 3 in this phase.** No new Docker/lab orchestration code.

---

## Phase 3: Electron main / preload setup

Secure IPC boundary between UI and system operations.

- [x] Implement `src/main/main.js`:
  - [x] Create `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`
  - [x] Load `preload.js`
  - [x] On `app.whenReady`: DB placeholder, register IPC, Discord RPC placeholder (no full RPC yet; no Docker detection)
  - [x] Handle window lifecycle (`activate`, `window-all-closed` with platform-aware quit)
- [x] Implement `src/main/preload.js`:
  - [x] Expose a minimal `window.api` via `contextBridge` (no raw `ipcRenderer` in renderer)
  - [x] Group methods: `app`, `tools`, `labs`, `progress`, `questions`, `settings`, `discord`
- [x] Add `src/main/ipc/handlers.js` to register all `ipcMain.handle` channels in one place
- [x] Add `src/main/utils/paths.js` for labs root (dev vs packaged `extraResources`)
- [x] Add `src/main/utils/logger.js` for consistent main-process logging
- [x] Return structured errors: `{ ok: true, data }` / `{ ok: false, error: { code, message } }`
- [x] Renderer IPC status: Main process / Preload connected (`IpcConnectionStatus`)

**Done when:** Renderer can call a test IPC ping and receive a response.

**Do not start Phase 4 in this phase.** `tools.getStatus` returns placeholders only.

---

## Phase 4: Docker detection

Detect whether the user can run labs before starting containers.

- [x] Implement `src/main/toolDetection.js`
- [x] On startup (and on demand from Tools page), detect:

  | Tool        | Probe command(s)                          | Status values                          |
  |-------------|-------------------------------------------|----------------------------------------|
  | Docker      | `docker --version`, `docker info`         | installed, missing, broken, needs_setup |
  | VirtualBox  | `VBoxManage --version`                    | installed, missing, broken             |
  | VMware      | platform-specific                         | installed, missing                     |
  | Hyper-V     | Windows-only check                        | installed, missing, n/a (Linux)        |
  | QEMU/KVM    | `qemu-system-x86_64 --version`, `virsh`   | installed, missing, n/a (Windows)    |

- [x] Parse version strings; set **needs_setup** when CLI exists but daemon is not running
- [x] Attach `installUrl` and short `message` for UI (link to install guides)
- [x] Expose `tools.getStatus()` and `tools.refreshStatus()` over IPC
- [ ] Block lab start when Docker is not **ready**; route user to Docker setup screen (Phase 6)

**Done when:** Tools page shows accurate Docker state on Windows and Linux test machines.

**Do not start Phase 5 in this phase.** No `dockerManager` yet.

---

## Phase 5: Docker manager

All container operations go through one module using the Docker CLI (no socket library for MVP).

- [x] Implement `src/main/dockerManager.js`
- [x] Methods (async/await, `execFile`/`spawn` with timeouts):
  - [x] `checkReady()` — wraps tool detection
  - [x] `pullImage(tag)`
  - [x] `buildImage(buildPath, tag)`
  - [x] `runContainer({ name, image, ports, env })`
  - [x] `stopContainer(nameOrId)`
  - [x] `removeContainer(nameOrId)`
  - [x] `inspectContainer(nameOrId)`
  - [x] `listContainers({ labelFilter })`
  - [x] `exec(containerId, argv)` — for validation (argv array, no shell injection)
- [x] Container naming: `sysadmin-game-<labId>-<sessionId>`
- [x] Port mapping: read from lab JSON; if host port busy, pick next free port and return actual mapping
- [x] Defaults: **no** `--privileged`; centralize allowed `docker run` flags
- [x] User-friendly errors (daemon stopped, pull failed, port in use)

**Done when:** You can build/pull, start, stop, and remove a test container from the main process manually or via a dev script.

---

## Phase 6: Lab manager

Load human-readable lab definitions and orchestrate sessions.

- [x] Add `config/lab.schema.json` (JSON Schema)
- [x] Validate every `labs/*/lab.json` with **AJV** on load
- [x] Implement `src/main/labManager.js`:
  - [x] `listLabs()` — metadata for browser
  - [x] `getLab(id)`
  - [x] `startLab(id)` — pull or build → run → save session → return credentials + ports
  - [x] `stopLab(sessionId)` / `resetLab(sessionId)` / `destroyLab(sessionId)`
  - [x] `getSessionState(sessionId)`
- [x] Resolve `buildPath` relative to each lab folder
- [x] Image tag convention: `sysadmin-game/<lab-id>:latest` (local build, no registry required)
- [x] Copy `labs/` into packaged app via `electron-builder` `extraResources`
- [x] Wire lab lifecycle IPC: `labs.list`, `labs.get`, `labs.start`, `labs.stop`, `labs.reset`, `labs.destroy`, `labs.getSessionState`

**Done when:** `listLabs()` returns all five starter labs; `startLab('beginner-linux-001')` returns SSH connection info (after Phase 10 Dockerfile exists).

---

## Phase 7: Validation system

Verify lab completion safely inside the container.

- [x] Implement `src/main/validationManager.js`
- [x] Whitelist `validation.type` in schema and runtime
- [x] Support types:

  | Type              | How to verify                                      |
  |-------------------|----------------------------------------------------|
  | `command`         | `docker exec` + exit code                          |
  | `fileExists`      | `test -f <path>`                                   |
  | `serviceRunning`  | `systemctl is-active`                              |
  | `httpResponse`    | `curl` inside container or host to mapped port     |
  | `portOpen`        | TCP connect from host to mapped port               |
  | `userExists`      | `id -u <user>`                                     |
  | `permission`      | compare `stat -c %a` (or equivalent)             |
  | `packageInstalled`| `dpkg -s` / `rpm -q`                               |
  | `databaseQuery`   | stub or single example (optional for MVP)          |
  | `textAnswer`      | renderer-side normalized match to `acceptedAnswers`|

- [x] Add `src/main/utils/sanitize.js` for allowed validation arguments
- [x] `labs.validate(sessionId, payload)` IPC handler
- [ ] On success: notify `progressManager` and update Discord RPC (Phase 9)

**Done when:** `beginner-linux-001` validation passes only after `/tmp/lab-complete` exists in the container.

---

## Phase 8: SQLite progress / gamification

Persist XP, sessions, and unlock state locally.

- [x] Add `better-sqlite3` + `@electron/rebuild` in `postinstall`
- [x] Create `src/main/db/schema.sql` and `src/main/db/database.js`
- [x] Store DB under `app.getPath('userData')` (document path in README)
- [x] Tables (minimum):
  - [x] `user_profile` — xp, level
  - [x] `lab_progress` — lab_id, status, best_time_sec, hints_used, xp_earned, completed_at
  - [x] `lab_sessions` — session_id, lab_id, container_id, ports JSON, started_at
  - [x] `achievements` — id, unlocked_at
  - [x] `settings` — key/value (include `discordRpcEnabled`)
- [x] Implement `src/main/progressManager.js` — award XP, apply hint penalty, level thresholds from `config/app.defaults.json`
- [x] Implement `src/main/questionManager.js` — quiz questions (from lab JSON or `config/questions/`)
- [x] Implement `src/main/settingsManager.js` — get/set user preferences
- [x] Hint penalty: e.g. `finalXp = max(10, base - hintsUsed * penaltyPerHint)`
- [x] Difficulty unlocks: required level per lab in config
- [x] Placeholders: streaks, daily challenge (DB columns or UI-only stubs)
- [x] IPC: `progress.get`, `progress.getAchievements`, `settings.get`, `settings.set`

**Done when:** Completing a lab increments XP; restart app and progress persists.

---

## Phase 9: React / Tailwind UI

Polished dark UI with sidebar navigation and all core screens.

- [x] Design tokens: dark background, card surfaces, accent colors (online/warning/error)
- [x] `AppLayout` + `Sidebar` + page routes (state-based navigation for MVP):

  | Route            | Page              | Purpose                                      |
  |------------------|-------------------|----------------------------------------------|
  | `/`              | Dashboard         | Start/Continue, recent labs, XP, placeholders |
  | `/labs`          | LabBrowser        | Filter by difficulty/category                |
  | `/labs/:id`      | LabSession        | Credentials, timer, tasks, hints, validate   |
  | `/progress`      | Progress          | Completed labs, stats                        |
  | `/achievements`  | Achievements      | Locked/unlocked grid                         |
  | `/tools`         | ToolsStatus       | Docker and VM tool detection                 |
  | `/settings`      | Settings          | Preferences incl. Discord RPC toggle         |
  | `/setup/docker`  | DockerSetup       | Install guide when Docker missing/broken     |

- [x] Components: `LabCard`, `XpBar`, hints/validation in lab session, `ToolHealthCard`, `Modal`, onboarding wizard
- [x] Lab Session: copyable `ssh student@127.0.0.1 -p <port>` command
- [x] Hook `useIpc()` for typed API calls and loading/error states
- [x] Smooth CSS transitions on cards and route changes
- [x] Call Discord RPC updates on navigation and lab events (see below)

### Phase 9b: Discord Rich Presence (optional, privacy-friendly)

Rich Presence lets friends see high-level activity in Discord (e.g. “In Lab: First Linux Login”). It must **never** crash the app if Discord is missing or RPC fails.

- [x] Add dependency: `discord-rpc` (wrapped in `discordRpcManager.js`)
- [x] Create `src/main/discordRpcManager.js`:
  - [x] Application / Client ID: **`1505990175530942535`**
  - [x] `init()` — connect only if setting `discordRpcEnabled` is true (default **enabled**)
  - [x] `shutdown()` — clean disconnect on app quit
  - [x] `isDiscordRunning()` — best-effort detect (process check or failed connect → treat as unavailable)
  - [x] `setActivity(state)` — map app state to presence; **catch and log all errors**, never throw to caller
  - [x] Activity states:

    | App state        | Discord details (example)     |
    |------------------|-------------------------------|
    | Browsing labs    | `Browsing Labs`               |
    | Active lab       | `In Lab: <lab title>`         |
    | Lab completed    | `Completed Lab: <lab title>` (short-lived, then revert) |
    | Settings open    | `In Settings`                 |
    | Idle / home      | `Computer Server Labs`      |

  - [x] Do **not** expose passwords, ports, or host paths in presence text
- [x] Wire from:
  - [x] `main.js` — init after `app.whenReady`, shutdown on `before-quit`
  - [x] Lab session start/stop/complete → update presence
  - [x] Router/navigation in renderer → IPC `discord.updatePresence`
- [x] Settings UI:
  - [x] Toggle **Enable Discord Rich Presence** (default ON)
  - [x] Short privacy note: “Shows what you’re doing in the app, not your shell or files”
  - [x] Persist via `settingsManager` key `discordRpcEnabled`
- [x] Preload: no secret tokens in renderer; only `settings` + optional `discord.getStatus()` (connected / disabled / unavailable)
- [x] Document in [README.md](../README.md#discord-rich-presence-optional) and in this file (above)

**Done when:** Full UI flow works with Docker mocked or real; Discord shows activity when Discord desktop is running and setting is on; app runs fine when Discord is closed.

---

## Phase 10: Beginner lab (MVP gate)

**`labs/beginner-linux-001`** must be fully runnable — this is the release gate.

- [x] Create `labs/beginner-linux-001/lab.json` per schema (SSH, tasks, questions, hints, validation, `xpReward: 100`)
- [x] Create `labs/beginner-linux-001/Dockerfile`:
  - [x] Ubuntu LTS + `openssh-server`
  - [x] User `student` with password from lab.json (lab-only credentials)
  - [x] Hidden flag file in home directory
  - [x] Expose port 22; start sshd in entrypoint
- [x] Create `labs/beginner-linux-001/README.md` with manual `docker build` / test steps
- [x] Map host port `2222` (or dynamic if busy)
- [x] Validation: `fileExists` `/tmp/lab-complete` or `command` `test -f /tmp/lab-complete`
- [x] End-to-end test:
  1. Start lab from app
  2. SSH from host
  3. Find hidden file, read flag
  4. `touch /tmp/lab-complete`
  5. Validate in app → XP awarded

**Done when:** Phase 13 checklist passes for this lab on your dev machine.

---

## Phase 11: Remaining starter labs

Scaffold four additional labs (full polish can follow after MVP ship).

| Folder               | Title                      | Focus                          |
|----------------------|----------------------------|--------------------------------|
| `permissions-001`    | File Permissions Repair    | chmod/chown                    |
| `nginx-001`          | Broken NGINX               | fix config, restore HTTP       |
| `disk-cleanup-001`   | Disk Cleanup               | find large files, free space   |
| `service-repair-001` | Failed Service             | systemd unit repair            |

For each lab:

- [x] `lab.json` + `Dockerfile` + `README.md`
- [x] Validation appropriate to skill (http 200, free space threshold, `serviceRunning`, etc.)
- [x] Appears in Lab Browser with correct difficulty/category
- [x] Build locally: `sysadmin-game/<lab-id>:latest`

**Done when:** All five labs listed in browser; at least smoke-tested that each container starts and SSH/shell access works.

---

## Phase 12: Packaging (Windows / Linux)

Ship installable artifacts with electron-builder.

- [x] Configure `electron-builder` in `package.json` or `electron-builder.yml`
- [x] Targets:
  - [x] Windows: NSIS `.exe` (x64)
  - [x] Linux: AppImage + `.deb`
- [x] `extraResources`: include `labs/` and `config/`
- [x] App ID and product name: `Computer Server Labs` (appId `com.sysadmingame.quizes` unchanged for compatibility)
- [x] npm scripts: `package:win`, `package:linux`
- [x] Document code signing as optional (community / maintainer setup)
- [x] Confirm **no** macOS target
- [ ] Smoke-test installed app: tool detection + start `beginner-linux-001` (installer builds; run full E2E on installed copy locally)

**Done when:** Installers build on CI or locally and launch the packaged app.

---

## Phase 14: User data, credentials, terminal, and auto-tracking

Centralize all user-generated data, remove hardcoded lab passwords, and ship a safe integrated terminal.

### Central app data folder

- [x] `src/main/dataDirectoryManager.js` — `ensureDataDirectories()`, `getDataDirectoryInfo()`, `resetAllLocalData()`
- [x] Subfolders: `profile/`, `sessions/`, `logs/`, `cache/`
- [x] `DATA_FOLDER.txt` readme under `userData`
- [x] Settings page shows data folder path
- [x] **Delete all local data** with confirmation (`data:resetAll`)

### Lab profile setup

- [x] `profile/lab-profile.json` under `userData` (display name, experience level)
- [x] Onboarding wizard **Lab profile** step
- [x] Re-show onboarding when profile incomplete (`labProfileSetupComplete`)

### Per-session credentials

- [x] `src/main/credentialManager.js` — generate, store, apply via container env
- [x] Reject `credentials.password` in `lab.json` validation
- [x] All five starter labs use `generatedPerSession: true`
- [x] Passwords never logged (`logger.js` redaction)

### Auto-tracking / objectives

- [x] `objectives` in `lab.schema.json` with `autoCheck` types
- [x] `src/main/autoProgressManager.js` — poll + evaluate checks
- [x] Session panel shows objective checklist
- [x] `validationManager` refreshes objectives on validate

### Integrated safe Docker terminal

- [x] `src/main/terminalManager.js` — `docker exec -i` only; no host shell
- [x] `LabTerminal.jsx` in session panel
- [x] Detach on lab stop / app quit

### VM / RDP viewer (planning)

- [x] [docs/vm-rdp-viewer.md](vm-rdp-viewer.md) — viewer approach for Windows/Linux VM labs
- [x] Forward-compatible `vm.viewer` notes in schema docs

### Expanded catalog (roadmap)

- [x] [docs/lab-catalog-roadmap.md](lab-catalog-roadmap.md)

### Safety upgrades

- [x] Safety Mode default ON (`settingsManager` + config)
- [x] `requireDestroyConfirmation` from config
- [x] Discord RPC: lab title only — no passwords, ports, paths, usernames
- [x] Logger redacts password/secret/token fields

**Done when:** `npm run dev` works; `beginner-linux-001` uses generated credentials; integrated terminal connects only to container; delete local data works.

---

## Phase 15: Lab Builder (developer drafts)

Scoped authoring for Docker labs stored under `userData/lab-builder/drafts/`, guarded by Developer Mode.

- [x] Settings toggle: **Developer Mode** (with onboarding-style confirmation copy)
- [x] Main process: draft lifecycle + safety analyzer + IPC `labBuilder:*` (see `labBuilderManager.js`)
- [x] Renderer: **Lab Builder** page — editors, templates, validate, import/export, Docker **Build/Test** (no XP)
- [x] Optional **dev unpackaged** unsafe override for blocked analyzer findings (never in packaged prod)
- [x] Documentation: `docs/lab-builder.md`, `docs/vm-labs.md`, cross-links from this repo

**Done when:** With Developer Mode on, create a Docker draft → Build/Test → validate inside container → stops/teardown without XP changes; bundled catalog labs behave as before.

---

## Phase 13: Testing checklist

Run this on **Windows 10/11** and **one Linux desktop** before calling MVP complete.

### Install and tooling

- [x] Clone repo → `npm install` succeeds (including native SQLite rebuild)
- [x] `npm run dev` opens the app without console errors
- [x] Tools page: Docker shows **Installed** when daemon is running
- [x] Tools page: Docker shows **Missing** or **Needs setup** when appropriate
- [x] Docker setup page links to official install docs

### Labs

- [x] Lab Browser lists five starter labs
- [x] Starting `beginner-linux-001` builds/pulls image and starts container
- [x] UI shows host, SSH port, username, password
- [x] SSH from host into container succeeds
- [x] Hints unlock gradually; XP decreases with hint usage
- [ ] Quiz/text answers accept normalized variants (no lab uses textAnswer validation in MVP; IPC exists)
- [x] Validation succeeds only when lab objective is actually met
- [x] Stop/reset/destroy cleans up container

### Progress

- [x] XP and level update on completion
- [x] Progress persists after app restart
- [x] Achievement unlocks on first lab complete (if configured)

### Discord Rich Presence

- [x] With Discord desktop running and RPC **enabled**: presence updates when browsing labs, entering a lab, completing a lab, opening settings
- [x] With RPC **disabled** in settings: no connection attempted
- [x] With Discord **not running**: app works normally, no crash, status shows unavailable
- [x] Presence text does not include secrets (passwords, ports, file paths)

### Security (smoke)

- [x] Renderer cannot access Node APIs directly
- [x] Invalid `lab.json` rejected at load
- [x] Unknown validation type rejected
- [x] No arbitrary shell from user input in `docker exec`

### Packaging

- [x] `npm run package:win` OR `package:linux` produces installer
- [x] Packaged app launches; bundled `labs/` and `config/` verified under `resources/`
- [ ] Packaged app runs `beginner-linux-001` end-to-end (manual: install NSIS build with Docker running)

### Docs

- [x] README install/dev/package sections accurate
- [x] `docs/creating-labs.md` explains how to add a lab
- [x] `docs/security-model.md` describes sandbox boundaries

---

## VM support (architecture only — post-MVP)

Do not block MVP on this.

- [ ] `src/main/vmManager.js` — exported stubs for VirtualBox, VMware, Hyper-V, QEMU/KVM
- [ ] Document future ISO/snapshot/network flow in `docs/architecture.md`
- [ ] No bundled copyrighted ISOs; user-provided or official mirrors only (documented)

---

## Future placeholders (document only)

Track in `docs/architecture.md`, not in MVP build:

- Multi-machine and networking labs
- Kubernetes, Active Directory, pfSense labs
- Online leaderboards, community lab registry
- AI-generated labs, Steam integration, cloud-hosted labs

---

## Suggested commit milestones

Optional git milestones while following this doc:

1. `chore: scaffold electron-vite project`
2. `docs: add OSS templates and contributor guides`
3. `feat: main process IPC and tool detection`
4. `feat: docker and lab managers`
5. `feat: validation and sqlite progress`
6. `feat: renderer UI and discord rpc`
7. `feat: beginner-linux-001 lab`
8. `feat: starter labs scaffold`
9. `build: electron-builder win/linux`

---

## Quick reference — key files to create

| File | Phase |
|------|-------|
| `src/main/main.js` | 3 |
| `src/main/preload.js` | 3 |
| `src/main/toolDetection.js` | 4 |
| `src/main/dockerManager.js` | 5 |
| `src/main/labManager.js` | 6 |
| `src/main/validationManager.js` | 7 |
| `src/main/progressManager.js` | 8 |
| `src/main/dataDirectoryManager.js` | 14 |
| `src/main/credentialManager.js` | 14 |
| `src/main/autoProgressManager.js` | 14 |
| `src/main/terminalManager.js` | 14 |
| `src/main/discordRpcManager.js` | 9 |
| `src/renderer/app.jsx` | 9 |
| `labs/beginner-linux-001/*` | 10 |
| `electron-builder` config | 12 |

---

*Last updated for MVP planning. Adjust checkboxes as implementation proceeds.*

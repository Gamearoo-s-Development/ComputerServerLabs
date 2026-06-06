# Security Model

> **See also:** [threat-model.md](threat-model.md) · [security-hardening.md](security-hardening.md) · [developer-security.md](developer-security.md) · [../SECURITY.md](../SECURITY.md)

This document explains how **Computer Server Labs** limits risk to your computer while still using real Linux environments for training.

**Platforms:** Windows 10/11 and Linux desktop. **MVP labs:** Docker containers only.

---

## Design principles

1. **Host safety first** — the app must not brick or reconfigure the user’s daily system.
2. **Isolation** — training happens inside lab containers, not on the host OS.
3. **Least privilege** — no privileged containers or host mounts by default.
4. **Explicit consent** — warnings before labs; confirmations before destroy/reset; optional opt-out of Safety Mode with clear risk text.
5. **Whitelist validation** — only known validation types; arguments sanitized; execution inside the container.

---

## Community platform disclaimer (plain-language)

Computer Server Labs is a **community-made learning platform**. Labs may be authored by community members and may contain mistakes or unstable configurations.

- The software is provided **as-is** with no warranty.
- Users are responsible for their own systems and environments.
- Safety Mode reduces risk, but does not make arbitrary lab content “safe by default.”
- Import labs only from sources you trust.
- Windows container labs (optional) use significant disk/RAM and require Docker Desktop configured for Windows containers on a compatible Windows host. They are server/PowerShell environments — not Windows desktop.
- The project is not affiliated with Microsoft, Docker, Oracle, VMware, or other vendors.

## Command guide safety

The app may show a “Possible Commands” list during labs. This is intentionally broader than any single lab solution:

- Some commands are useful, some are plausible distractions.
- The UI should never suggest destructive **host** commands (disk/boot/firewall/shutdown classes).
- Risky commands should include a warning and remind users to run them **inside the lab environment**.

---

## What the app can change

| Target | Examples |
|--------|----------|
| Application data | Profile, XP, settings, SQLite DB under Electron `userData` |
| Docker objects it creates | Lab containers/images named with app prefix |
| In-repo lab files (development) | Only when you edit the clone |

## What the app cannot change

- Files outside `userData` (documents, system directories)
- Boot configuration (`bcdedit`, firmware)
- Disks (`diskpart`, `format`, `dd`, `mkfs`)
- Registry keys (except read-only detection for tools like VirtualBox install path)
- Firewall or network stack on the host
- Shutting down or rebooting the host

Tool detection uses **read-only** probes where possible (`docker --version`, `docker info`, etc.).

---

## Docker boundaries (MVP)

| Rule | Detail |
|------|--------|
| Runtime | Labs use `runtime: "docker"` in `lab.json` |
| CLI only | Main process invokes `docker` via `execFile` with argv arrays |
| No default `--privileged` | Centralized in `dockerManager` |
| No host bind mounts | Unless lab declares need + user confirms + Safety Mode allows |
| Network | Published ports only; document mapped ports in UI |
| Cleanup | Stop/remove lab containers on reset/destroy (with confirmation) |

---

## Validation

- Runs **inside** the lab container: `docker exec <container> …`
- Types are **whitelisted** in `config/lab.schema.json` (e.g. `fileExists`, `command`, `serviceRunning`)
- **Unknown types are rejected**
- User quiz answers (`textAnswer`) are compared in the renderer—no host shell
- Never pass user free text into host `exec` or unvalidated container shell strings

---

## Lab credentials

- **Generated per session** — never hardcoded in `lab.json` or Docker images
- Stored under `userData/sessions/` (mode `600` on supported platforms)
- Passed to containers as `LAB_USERNAME` / `LAB_PASSWORD` environment variables
- Displayed as **temporary lab-only** credentials in the session panel
- UI must state they are for the isolated lab environment only
- **Never logged**, never sent to Discord RPC, never included in error reports
- Example label: *“Training credentials — fictional lab environment”*

---

## Local data folder (`userData`)

All user-generated data lives under Electron `app.getPath('userData')`:

| Path | Contents |
|------|----------|
| `progress.db` | SQLite XP, settings, achievements |
| `profile/` | Lab profile, activity feed |
| `sessions/` | Per-session credential records |
| `lab-builder/` | Developer Mode drafts only (`drafts/` under this tree) |
| `DATA_FOLDER.txt` | Human-readable folder guide |

Nothing user-specific is written to the install directory or project clone. **Delete all local data** in Settings removes this folder's contents safely (with confirmation).

---

## Integrated lab terminal

- Attaches **only** via `docker exec -i <container> /bin/bash` (or `/bin/sh` fallback)
- **Never** spawns a host shell (`cmd.exe`, `powershell`, `/bin/bash` on host) for Docker workstation sessions
- Detached when the lab stops or the app quits
- Input is size-limited; no arbitrary host command injection

### Local Terminal Workstation (advanced, not recommended)

Optional workstation that opens the user's **real** system terminal with SSH connection hints only:

- Disabled by default; requires Settings → **Allow Local Terminal Workstation**
- Lab must set `workstation.allowLocalTerminal: true`
- Per-session confirmation checkbox before deploy
- Never auto-selected; never used as lab recommended default
- Connection routes use **127.0.0.1** and published host ports only (no Docker internal IPs)
- The app does **not** run lab commands on the host automatically

Prefer **Docker container** workstations for sandboxed practice.

---

## User warnings (required in product)

### Before starting a lab

Show a dialog or panel that explains:

- The lab runs in an **isolated Docker container**
- Credentials are **for this lab only**
- The app will **not** modify files on your host (with Safety Mode on)
- Reset/destroy removes the lab container

### Elevated or unsafe lab requests

If a lab definition includes (now or in the future):

- `privileged: true`
- Host bind mounts
- Host networking
- Extra capabilities

→ Show an **additional warning** and block unless Safety Mode is off and user confirms.

### Reset / destroy

Always require **confirmation** before removing containers or wiping lab state.

---

## Safety Mode

**Default: enabled** (`safetyMode.enabled: true` in settings — implementation in Phases 5–7).

When Safety Mode is **ON**, the app must **refuse**:

| Request | Action |
|---------|--------|
| `--privileged` | Block start |
| Host volume mounts | Block start |
| Host shell for validation | Block |
| Unknown `validation.type` | Block |
| Lab flag `unsafeCapabilities` (future schema) | Block |

When Safety Mode is **OFF** (if offered):

- Require explicit toggle + risk acknowledgment in Settings
- Log that user accepted elevated risk
- Still never run forbidden **host** destructive commands

---

## Anti-bricking command denylist (host)

The main process must never execute on the host:

`rm -rf`, `diskpart`, `format`, `bcdedit`, `reg delete`, `dd`, `mkfs`, `shutdown`, `reboot`, firewall reset scripts, or equivalent.

This list is not exhaustive; use judgment: if a command can destroy data or deny service on the host, it is out of scope.

---

## Discord Rich Presence

- Optional; default on; disable in Settings
- Shares coarse activity (e.g. “Browsing Labs”, active lab **title** only)
- **Never** passwords, ports, paths, usernames, or command output
- RPC failure must not crash the app

---

## VM labs (not included)

VirtualBox/VM lab support has been removed from the current product focus. All labs use `runtime: "docker"`. VM documentation under `docs/vm-*.md` is archived for reference only.

---

## Contributor checklist

See [MVP safety rules](MVP_STEP_BY_STEP.md#system-safety-and-anti-bricking-rules) and [creating-labs.md](creating-labs.md).

---

## Reporting issues

[Vulnerability reporting](../SECURITY.md)

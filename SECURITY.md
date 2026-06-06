# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `0.1.x` (MVP development) | Yes — best-effort on `main` |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Use GitHub **Private vulnerability reporting** (if enabled) or contact maintainers directly.

Include: description, impact, reproduction steps, commit/version, and OS.

We aim to acknowledge within 7 days.

## Architecture summary

| Layer | Trust | Controls |
|-------|-------|----------|
| Renderer | Untrusted | No Node integration; CSP; IPC only |
| Preload | Trusted bridge | `contextBridge` whitelist |
| Main | Trusted | Validation, Docker, PTY, SQLite |
| Lab containers | Untrusted content | Isolated network, resource limits, no host mounts |

Full detail: [docs/threat-model.md](docs/threat-model.md), [docs/security-model.md](docs/security-model.md), [docs/security-hardening.md](docs/security-hardening.md).

## Electron

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`
- External links require confirmation (`app:openExternal`)
- In-page navigation restricted to app origins

## IPC

- AJV-validated payloads for settings, Discord presence, data reset, terminal I/O
- Lab/session IDs match strict patterns
- Unknown object keys stripped where schemas apply

## Docker & labs

- Managed containers: labels, per-session networks, cgroup limits, `cap-drop ALL`
- Safety Mode (default on): blocks privileged mode, host mounts, host networking
- `lab.json` schema + folder scan (no `.js` / executables in lab tree)
- Community labs are **user-generated** and **not officially audited**

## Terminal

- No host shell for players — `docker exec` into sandbox helper only
- Debug logs require Developer Mode

## Data & secrets

- SQLite: parameterized queries, `userData` path only
- Credentials/SSH keys: session files with restricted permissions; redacted from logs
- Discord RPC: lab titles/status only — never passwords, IPs, ports, or command output

## Dependency audit

```bash
npm run security:audit   # fail on high+ 
npm run security:check   # production deps only
```

## Developer guidelines

See [docs/developer-security.md](docs/developer-security.md).

## Safe harbor

We appreciate responsible disclosure and will credit reporters who agree to coordinated disclosure.

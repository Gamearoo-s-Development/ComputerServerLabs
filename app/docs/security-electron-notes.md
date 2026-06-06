# Electron version and security notes

## Pinned version

| Package | Version | Notes |
|---------|---------|--------|
| `electron` | **36.9.5** (exact pin) | Same major line as MVP; patch release for advisories |

We **do not** run `npm audit fix --force` in CI or locally — that can jump to unrelated major versions (e.g. Electron 42) and break native rebuilds.

## npm audit and accepted risk

`npm audit` may still list **high** findings for Electron below a moving advisory cutoff. Many entries apply to features we do not expose (custom protocols, USB picker, login items, etc.).

**Decision:** Stay on **Electron 36.9.5** until a deliberate upgrade pass (rebuild native modules, regression test labs/terminal, update docs).

Re-check advisories when planning upgrades: [Electron releases](https://www.electronjs.org/releases/stable).

## Mitigations enabled in this app

These reduce impact even when advisories remain open:

| Control | Status |
|---------|--------|
| `contextIsolation` | `true` |
| `nodeIntegration` | `false` |
| `sandbox` (renderer) | `true` |
| `webSecurity` | `true` |
| Content-Security-Policy | Strict script/connect/frame rules in `index.html` |
| Navigation / `window.open` | Blocked or confirmed external only |
| IPC | AJV-validated payloads; no raw Node in renderer |
| Lab terminal | `docker exec` into helper container only — no host shell |
| Docker labs | No privileged/host-network mounts (Safety Mode) |
| Discord RPC | Sanitized text; no credentials or ports |

See also [security-model.md](security-model.md), [threat-model.md](threat-model.md), [security-hardening.md](security-hardening.md).

## Upgrade checklist (when bumping Electron)

1. Pin new exact version in `package.json`.
2. `npm install` / `npm run rebuild:native` on Windows and Linux.
3. Run `npm run security:audit` and read release notes for breaking security behavior.
4. Smoke-test: lab deploy, Lab Terminal PTY, SQLite progress, packaging.
5. Update this document and `SECURITY.md`.

## Production dependencies

Runtime `npm audit --omit=dev` (`npm run security:check`) should report **no** high issues in shipped JS dependencies. Electron is a **devDependency** (bundled at pack time), so it appears in full `security:audit` only.

# Threat model — Computer Server Labs

## Assets

| Asset | Risk if compromised |
|-------|---------------------|
| Host OS (files, shell, registry) | Critical |
| Docker daemon | High |
| Player progress / profile (SQLite) | Medium |
| Session credentials & SSH keys (userData) | High |
| Discord Rich Presence channel | Low (display spoofing) |

## Trust boundaries

```text
┌─────────────────────────────────────────────────────────────┐
│ Host OS                                                      │
│  ┌──────────────┐    IPC (validated)    ┌───────────────┐ │
│  │ Renderer     │ ◄──────────────────────► │ Main process  │ │
│  │ (untrusted)  │                        │ Node + Docker │ │
│  └──────────────┘                        └───────┬───────┘ │
│                                                   │ docker CLI│
│                          ┌────────────────────────▼─────────┐│
│                          │ Lab containers (untrusted content)││
│                          └──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

- **Renderer** — React UI; treated as hostile (XSS, modified preload calls).
- **Main process** — Enforces policy; only component that runs Docker, PTY, and filesystem writes.
- **Lab containers** — Community-authored; must not reach host or other players’ data.

## Threats & mitigations

| Threat | Mitigation |
|--------|------------|
| Renderer escapes to Node | `contextIsolation`, `nodeIntegration: false`, `sandbox: true`, narrow `contextBridge` |
| Malicious IPC payloads | AJV schemas, ID patterns, size limits, `removeAdditional` |
| Host shell via terminal | PTY only via `docker exec` into labeled helper container |
| Privileged / host-network labs | Safety Mode + schema; runtime `docker run` hardening flags |
| Path traversal on import | `resolvePathWithin`, draft roots only |
| Secrets in logs / RPC | Logger redaction; RPC text sanitizer |
| Orphan containers on crash | `before-quit` cleanup; managed labels |
| SQL injection | Parameterized queries only |
| Zip slip / malicious lab pack | Extension scan; symlink rejection (import folder) |

## Out of scope (MVP)

- Formal lab code audit of every community lab
- Network egress filtering inside containers
- VM runtime isolation (documented, not executable)

## Residual risk

- **Developer Mode** relaxes port binding and exposes debug surfaces — user opt-in.
- **Safety Mode off** allows schema-valid but riskier lab definitions — discouraged.
- **Container root** — images may still run as root inside namespace; host mounts blocked.

See [security-hardening.md](security-hardening.md) and [security-model.md](security-model.md).

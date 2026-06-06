# Developer security guidelines

## Adding IPC channels

1. Add handler in `src/main/ipc/handlers.js` only — never expose Node APIs in preload beyond `invoke`.
2. Validate inputs with `src/main/security/ipcValidation.js` (add AJV schema if new shape).
3. Use `assertSafeLabId` / `assertSafeSessionId` for any Docker or session operation.
4. Return `fail('INVALID_INPUT', …)` via `ipcValidationFail` — do not leak stack traces unless Developer Mode.

## Adding lab features

- Extend `config/lab.schema.json` with `additionalProperties: false` on every object.
- Run `assertLabSafety` — never add host mounts or privileged flags without explicit product decision.
- Do not execute `.js` from lab folders; shell scripts belong in the image build only.
- Validation checks must use allowlisted `validation.type` values and `sanitizeExecArgv`.

## Terminal & Docker

- Never spawn host `powershell`, `bash`, or `cmd` for player sessions.
- PTY path: `docker exec` → helper container → `su` lab user.
- `docker exec` argv arrays only; avoid `sh -c` on the host CLI.

## Logging & RPC

- Use `logger` — secrets are redacted by key name and pattern.
- Discord presence: pass through `sanitizeDiscordPresencePayload`; never include ports, IPs, or credentials.

## Testing security

```bash
npm run lint
npm run security:audit
```

Manually verify: quit app with active lab → no labeled containers left (`docker ps`).

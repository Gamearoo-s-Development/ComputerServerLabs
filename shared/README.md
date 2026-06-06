# Shared package

Cross-cutting schemas, types, branding, and utilities used by the desktop app and website for **Computer Server Labs**.

| Path | Purpose |
|------|---------|
| `branding/` | User-facing app name, short name, website URL |
| `workstations/` | Workstation provider helpers, login modes, readiness logic |
| `network/` | Session network addressing helpers |
| `lab/` | Lab resource label helpers |
| `lab-format/lab.schema.json` | Canonical lab.json JSON Schema |

Import from app or website:

```js
import { APP_NAME } from '@sysadmin-game/shared/branding/appBrand.js'
import { resolveWorkstationLoginMode } from '@sysadmin-game/shared/workstations/workstationLoginMode.js'
```

The desktop app also ships a copy of `lab.schema.json` under `app/config/` for packaged builds.

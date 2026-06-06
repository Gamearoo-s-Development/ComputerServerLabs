# Assets

Application branding and icons bundled via `extraResources` when packaged.

| File | Purpose |
|------|---------|
| `icon.png` | Square **mark** (hex + flask only) — taskbar, favicon, collapsed sidebar |
| `logo.png` | Full **wordmark** — expanded sidebar (`src/renderer/public/logo.png`) |

Regenerate the mark icon from the wordmark (does **not** overwrite `logo.png`):

```bash
node scripts/install-brand-icons.mjs
```

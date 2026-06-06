# Assets

Application branding and icons bundled via `extraResources` when packaged.

| File | Purpose |
|------|---------|
| `icon.png` | Square app icon (Windows/Linux installers, taskbar, favicon) |
| `logo.png` | Wordmark for in-app sidebar (lives in `src/renderer/public/`) |

Regenerate both from artwork:

```bash
node scripts/install-brand-logo.mjs path/to/new-logo.png
```

That updates logos, transparency, and all `icon.png` copies under `app/assets/`, `app/resources/`, etc.

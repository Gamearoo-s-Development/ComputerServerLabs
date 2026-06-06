# Assets

Application branding and icons bundled via `extraResources` when packaged.

| File | Purpose |
|------|---------|
| `icon.png` | Primary app icon (Linux AppImage/deb, dev window icon) |

Windows NSIS builds currently use this PNG via electron-builder. For production releases, generate `build/icon.ico` — see [build/ICON.md](../build/ICON.md).

Source copy also lives at `resources/icon.png` for electron-vite / dev tooling.

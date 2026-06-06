# Windows installer icon (`.ico`)

The Linux and development builds use `assets/icon.png`.

**NSIS on Windows** works best with a multi-size `.ico` file. This repository does not commit `build/icon.ico` yet.

## Generate from `assets/icon.png`

Use any of these approaches locally (do not commit secrets or third-party installers):

### Option A — electron-icon-builder

```bash
npm install --save-dev electron-icon-builder
npx electron-icon-builder --input=./assets/icon.png --output=./build --flatten
```

Then set `win.icon` in `electron-builder.yml` to `build/icons/win/icon.ico` (or copy to `build/icon.ico`).

### Option B — ImageMagick

```bash
magick convert assets/icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

Update `electron-builder.yml`:

```yaml
win:
  icon: build/icon.ico
```

Until `build/icon.ico` exists, packaging uses `assets/icon.png` (supported by electron-builder, but `.ico` is recommended for production releases).

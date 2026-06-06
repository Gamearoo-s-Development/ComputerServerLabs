#!/usr/bin/env bash
# Build Linux release artifacts (AppImage + deb) — run on Linux or WSL, not plain Windows.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT_MAIN="app/out/main/main.js"
ON_WINDOWS_MOUNT=0
[[ "$ROOT" == /mnt/* ]] && ON_WINDOWS_MOUNT=1

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing $1. Install with: sudo apt-get install -y squashfs-tools fakeroot dpkg"
    exit 1
  fi
}

rollup_linux_ready() {
  node -e "require('@rollup/rollup-linux-x64-gnu')" >/dev/null 2>&1
}

install_linux_optional_deps() {
  if rollup_linux_ready; then
    return 0
  fi
  echo "==> Installing Linux Vite binaries (@rollup/rollup-linux-x64-gnu @esbuild/linux-x64)…"
  npm install @rollup/rollup-linux-x64-gnu @esbuild/linux-x64 --no-save --no-audit --no-fund --include=optional
  if ! rollup_linux_ready; then
    return 1
  fi
}

need mksquashfs
need fakeroot
need dpkg-deb

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found inside WSL. Install Linux Node (do not rely on Windows node.exe):"
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi

if node -p "process.platform" 2>/dev/null | grep -q win32; then
  echo "You are running Windows Node from WSL (/mnt/c/...). Install Linux Node instead:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi

# /mnt/c/ + existing Windows build: skip Vite in Linux (avoids Rollup optional-dep fights).
if [ "$ON_WINDOWS_MOUNT" -eq 1 ] && [ -f "$OUT_MAIN" ]; then
  echo "==> Repo on Windows drive — using app/out/ built on Windows; skipping Vite in WSL"
  export SKIP_APP_VITE_BUILD=1
  echo "==> Installing npm deps for electron-builder (no postinstall)…"
  npm install --ignore-scripts --no-audit --no-fund
  if command -v npx >/dev/null 2>&1; then
    npx patch-package --patch-dir app/patches 2>/dev/null || true
  fi
elif [ "$ON_WINDOWS_MOUNT" -eq 1 ] && [ ! -f "$OUT_MAIN" ]; then
  echo "No app/out/ on Windows drive. Build on Windows first, then re-run WSL packaging:"
  echo "  npm run build:app"
  echo "  npm run package:linux:wsl"
  exit 1
else
  echo "==> Installing npm dependencies (Linux native rebuild)…"
  npm install --include=optional --no-audit --no-fund
  if ! install_linux_optional_deps; then
    echo ""
    echo "Could not install Linux Vite binaries on this path. Copy repo into WSL home:"
    echo "  cp -a /mnt/c/Dev/SysAdminGame ~/SysAdminGame && cd ~/SysAdminGame && bash scripts/linux-package-release.sh"
    exit 1
  fi
fi

echo "==> Building Linux packages (AppImage + deb)…"
npm --workspace app run package:linux:release

echo ""
echo "Done. Artifacts in app/dist/:"
ls -lh app/dist/*.AppImage app/dist/*.deb 2>/dev/null || ls -lh app/dist/

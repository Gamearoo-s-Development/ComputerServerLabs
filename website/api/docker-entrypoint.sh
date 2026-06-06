#!/bin/sh
set -e

mkdir -p /data/lab-packs

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] Syncing official labs (app bundle + catalog-only)..."
  node src/db/seed.js || true
fi

echo "[entrypoint] Starting registry API on ${HOST:-0.0.0.0}:${PORT:-8787}..."
exec node src/index.js

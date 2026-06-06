#!/bin/bash
# permissions-001 — assign config ownership to the generated session user
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"
if [ -n "$u" ] && [ -f /var/www/config/app.conf ]; then
  chown "$u:$u" /var/www/config/app.conf 2>/dev/null || true
fi

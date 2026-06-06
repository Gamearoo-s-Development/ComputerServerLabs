#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home" /var/log/demo-app

if command -v sudo >/dev/null 2>&1; then
  getent group sudo >/dev/null 2>&1 && usermod -aG sudo "$u" 2>/dev/null || true
fi

cat >"$home/README.txt" <<'EOF'
Mission: Log Rotation Basics
----------------------------
A demo application writes to /var/log/demo-app/app.log.

1. Inspect the log directory and app.log
2. Create /etc/logrotate.d/demo-app with daily rotation, compress, rotate 3
3. Run logrotate -f /etc/logrotate.d/demo-app
4. Confirm /var/log/demo-app/app.log.1.gz exists

Use Validate / Check in the app when rotation succeeded.
EOF

chown "$u:$u" "$home/README.txt" 2>/dev/null || true

cat >/var/log/demo-app/app.log <<'EOF'
2026-01-15T10:00:01Z INFO demo-app started
2026-01-15T10:05:12Z WARN cache warm slow
2026-01-15T10:12:44Z INFO request handled id=42
2026-01-15T10:30:00Z ERROR disk threshold advisory only
EOF
chmod 644 /var/log/demo-app/app.log

rm -f /etc/logrotate.d/demo-app
rm -f /var/log/demo-app/app.log.1 /var/log/demo-app/app.log.1.gz /var/log/demo-app/app.log.2.gz

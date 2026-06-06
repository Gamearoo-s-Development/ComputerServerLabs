#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Parse Access Logs
Topic: combined log format
---------------------
1. Explore the topic: combined log format
2. Mark briefing read: touch /tmp/web-access-log-006-read
3. Create completion marker: touch /tmp/web-access-log-006-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/web-access-log-006-read /tmp/web-access-log-006-complete

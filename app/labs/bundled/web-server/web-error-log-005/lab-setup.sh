#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Read Error Logs
Topic: log troubleshooting
---------------------
1. Explore the topic: log troubleshooting
2. Mark briefing read: touch /tmp/web-error-log-005-read
3. Create completion marker: touch /tmp/web-error-log-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/web-error-log-005-read /tmp/web-error-log-005-complete

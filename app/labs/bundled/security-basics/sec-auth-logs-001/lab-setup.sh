#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Review Auth Logs
Topic: failed logins
---------------------
1. Explore the topic: failed logins
2. Mark briefing read: touch /tmp/sec-auth-logs-001-read
3. Create completion marker: touch /tmp/sec-auth-logs-001-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/sec-auth-logs-001-read /tmp/sec-auth-logs-001-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Permission Denied Errors
Topic: chmod/owner
---------------------
1. Explore the topic: chmod/owner
2. Mark briefing read: touch /tmp/ts-permission-denied-007-read
3. Create completion marker: touch /tmp/ts-permission-denied-007-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/ts-permission-denied-007-read /tmp/ts-permission-denied-007-complete

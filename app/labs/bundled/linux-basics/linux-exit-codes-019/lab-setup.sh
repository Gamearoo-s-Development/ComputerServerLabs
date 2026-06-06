#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Exit Codes
Topic: scripting readiness
---------------------
1. Explore the topic: scripting readiness
2. Mark briefing read: touch /tmp/linux-exit-codes-019-read
3. Create completion marker: touch /tmp/linux-exit-codes-019-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-exit-codes-019-read /tmp/linux-exit-codes-019-complete

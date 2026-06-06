#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Cron Job Silent Failure
Topic: MAILTO/logs
---------------------
1. Explore the topic: MAILTO/logs
2. Mark briefing read: touch /tmp/ts-cron-silent-009-read
3. Create completion marker: touch /tmp/ts-cron-silent-009-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/ts-cron-silent-009-read /tmp/ts-cron-silent-009-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Restore from Dump
Topic: import SQL
---------------------
1. Explore the topic: import SQL
2. Mark briefing read: touch /tmp/db-restore-006-read
3. Create completion marker: touch /tmp/db-restore-006-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/db-restore-006-read /tmp/db-restore-006-complete

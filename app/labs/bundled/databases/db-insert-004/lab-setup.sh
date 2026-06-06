#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Insert Training Rows
Topic: INSERT
---------------------
1. Explore the topic: INSERT
2. Mark briefing read: touch /tmp/db-insert-004-read
3. Create completion marker: touch /tmp/db-insert-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/db-insert-004-read /tmp/db-insert-004-complete

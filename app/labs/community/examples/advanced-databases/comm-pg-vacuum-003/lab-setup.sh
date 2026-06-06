#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: PostgreSQL Vacuum Concepts
Topic: bloat
---------------------
1. Explore the topic: bloat
2. Mark briefing read: touch /tmp/comm-pg-vacuum-003-read
3. Create completion marker: touch /tmp/comm-pg-vacuum-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-pg-vacuum-003-read /tmp/comm-pg-vacuum-003-complete

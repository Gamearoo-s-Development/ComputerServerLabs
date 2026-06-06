#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: SQLite Shell Basics
Topic: SELECT queries
---------------------
1. Explore the topic: SELECT queries
2. Mark briefing read: touch /tmp/db-sqlite-intro-001-read
3. Create completion marker: touch /tmp/db-sqlite-intro-001-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/db-sqlite-intro-001-read /tmp/db-sqlite-intro-001-complete

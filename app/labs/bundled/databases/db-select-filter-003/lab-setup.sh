#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Filter with WHERE
Topic: SQL filters
---------------------
1. Explore the topic: SQL filters
2. Mark briefing read: touch /tmp/db-select-filter-003-read
3. Create completion marker: touch /tmp/db-select-filter-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/db-select-filter-003-read /tmp/db-select-filter-003-complete

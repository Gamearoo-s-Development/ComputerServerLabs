#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Index Awareness
Topic: EXPLAIN intro
---------------------
1. Explore the topic: EXPLAIN intro
2. Mark briefing read: touch /tmp/db-index-basics-008-read
3. Create completion marker: touch /tmp/db-index-basics-008-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/db-index-basics-008-read /tmp/db-index-basics-008-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: psql Basics
Topic: PostgreSQL client
---------------------
1. Explore the topic: PostgreSQL client
2. Mark briefing read: touch /tmp/db-postgres-psql-009-read
3. Create completion marker: touch /tmp/db-postgres-psql-009-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/db-postgres-psql-009-read /tmp/db-postgres-psql-009-complete

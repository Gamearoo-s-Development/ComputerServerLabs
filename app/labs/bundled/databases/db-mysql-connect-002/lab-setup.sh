#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Connect to MySQL
Topic: mysql client
---------------------
1. Explore the topic: mysql client
2. Mark briefing read: touch /tmp/db-mysql-connect-002-read
3. Create completion marker: touch /tmp/db-mysql-connect-002-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/db-mysql-connect-002-read /tmp/db-mysql-connect-002-complete

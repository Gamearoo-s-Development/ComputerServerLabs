#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Redis PING/PONG
Topic: key-value health
---------------------
1. Explore the topic: key-value health
2. Mark briefing read: touch /tmp/db-redis-ping-010-read
3. Create completion marker: touch /tmp/db-redis-ping-010-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/db-redis-ping-010-read /tmp/db-redis-ping-010-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Redis RDB/AOF Concepts
Topic: durability
---------------------
1. Explore the topic: durability
2. Mark briefing read: touch /tmp/comm-redis-persistence-004-read
3. Create completion marker: touch /tmp/comm-redis-persistence-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-redis-persistence-004-read /tmp/comm-redis-persistence-004-complete

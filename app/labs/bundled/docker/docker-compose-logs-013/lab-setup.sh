#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Compose Logs
Topic: service debugging
---------------------
1. Explore the topic: service debugging
2. Mark briefing read: touch /tmp/docker-compose-logs-013-read
3. Create completion marker: touch /tmp/docker-compose-logs-013-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-compose-logs-013-read /tmp/docker-compose-logs-013-complete

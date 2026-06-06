#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Container Logs
Topic: docker logs
---------------------
1. Explore the topic: docker logs
2. Mark briefing read: touch /tmp/docker-logs-005-read
3. Create completion marker: touch /tmp/docker-logs-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-logs-005-read /tmp/docker-logs-005-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Shell into a Container
Topic: docker exec
---------------------
1. Explore the topic: docker exec
2. Mark briefing read: touch /tmp/docker-exec-006-read
3. Create completion marker: touch /tmp/docker-exec-006-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-exec-006-read /tmp/docker-exec-006-complete

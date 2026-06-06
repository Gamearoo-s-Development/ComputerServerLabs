#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Compose Up
Topic: multi-container
---------------------
1. Explore the topic: multi-container
2. Mark briefing read: touch /tmp/docker-compose-up-012-read
3. Create completion marker: touch /tmp/docker-compose-up-012-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-compose-up-012-read /tmp/docker-compose-up-012-complete

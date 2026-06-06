#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Docker Volumes
Topic: persistent data
---------------------
1. Explore the topic: persistent data
2. Mark briefing read: touch /tmp/docker-volume-ls-011-read
3. Create completion marker: touch /tmp/docker-volume-ls-011-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-volume-ls-011-read /tmp/docker-volume-ls-011-complete

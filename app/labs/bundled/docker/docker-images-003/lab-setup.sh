#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: List Local Images
Topic: docker images
---------------------
1. Explore the topic: docker images
2. Mark briefing read: touch /tmp/docker-images-003-read
3. Create completion marker: touch /tmp/docker-images-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-images-003-read /tmp/docker-images-003-complete

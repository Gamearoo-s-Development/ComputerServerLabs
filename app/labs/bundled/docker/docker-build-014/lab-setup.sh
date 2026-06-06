#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Build from Dockerfile
Topic: docker build
---------------------
1. Explore the topic: docker build
2. Mark briefing read: touch /tmp/docker-build-014-read
3. Create completion marker: touch /tmp/docker-build-014-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-build-014-read /tmp/docker-build-014-complete

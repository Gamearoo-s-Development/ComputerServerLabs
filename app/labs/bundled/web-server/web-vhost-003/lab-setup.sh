#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Virtual Host Basics
Topic: server_name
---------------------
1. Explore the topic: server_name
2. Mark briefing read: touch /tmp/web-vhost-003-read
3. Create completion marker: touch /tmp/web-vhost-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/web-vhost-003-read /tmp/web-vhost-003-complete

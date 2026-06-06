#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Port Already in Use
Topic: ss/lsof
---------------------
1. Explore the topic: ss/lsof
2. Mark briefing read: touch /tmp/ts-port-conflict-006-read
3. Create completion marker: touch /tmp/ts-port-conflict-006-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/ts-port-conflict-006-read /tmp/ts-port-conflict-006-complete

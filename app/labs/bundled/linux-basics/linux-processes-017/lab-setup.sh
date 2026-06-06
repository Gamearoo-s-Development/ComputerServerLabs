#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: List Processes
Topic: ps and top basics
---------------------
1. Explore the topic: ps and top basics
2. Mark briefing read: touch /tmp/linux-processes-017-read
3. Create completion marker: touch /tmp/linux-processes-017-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-processes-017-read /tmp/linux-processes-017-complete

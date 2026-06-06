#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Find Files by Name
Topic: find basics
---------------------
1. Explore the topic: find basics
2. Mark briefing read: touch /tmp/linux-find-009-read
3. Create completion marker: touch /tmp/linux-find-009-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-find-009-read /tmp/linux-find-009-complete

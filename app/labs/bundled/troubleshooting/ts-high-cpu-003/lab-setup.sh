#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: High CPU Investigation
Topic: top/ps
---------------------
1. Explore the topic: top/ps
2. Mark briefing read: touch /tmp/ts-high-cpu-003-read
3. Create completion marker: touch /tmp/ts-high-cpu-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/ts-high-cpu-003-read /tmp/ts-high-cpu-003-complete

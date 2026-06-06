#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Memory Pressure
Topic: free/htop
---------------------
1. Explore the topic: free/htop
2. Mark briefing read: touch /tmp/ts-high-mem-004-read
3. Create completion marker: touch /tmp/ts-high-mem-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/ts-high-mem-004-read /tmp/ts-high-mem-004-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Stop a Runaway Process
Topic: kill and signals
---------------------
1. Explore the topic: kill and signals
2. Mark briefing read: touch /tmp/linux-signals-018-read
3. Create completion marker: touch /tmp/linux-signals-018-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-signals-018-read /tmp/linux-signals-018-complete

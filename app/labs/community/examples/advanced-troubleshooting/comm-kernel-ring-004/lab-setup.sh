#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Kernel Ring Buffer
Topic: dmesg
---------------------
1. Explore the topic: dmesg
2. Mark briefing read: touch /tmp/comm-kernel-ring-004-read
3. Create completion marker: touch /tmp/comm-kernel-ring-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-kernel-ring-004-read /tmp/comm-kernel-ring-004-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Find SUID Binaries
Topic: risk inventory
---------------------
1. Explore the topic: risk inventory
2. Mark briefing read: touch /tmp/sec-suid-find-007-read
3. Create completion marker: touch /tmp/sec-suid-find-007-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/sec-suid-find-007-read /tmp/sec-suid-find-007-complete

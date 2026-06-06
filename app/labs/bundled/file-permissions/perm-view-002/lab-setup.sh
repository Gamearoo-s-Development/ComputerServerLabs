#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Read Permission Bits
Topic: ls -l output
---------------------
1. Explore the topic: ls -l output
2. Mark briefing read: touch /tmp/perm-view-002-read
3. Create completion marker: touch /tmp/perm-view-002-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-view-002-read /tmp/perm-view-002-complete

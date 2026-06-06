#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Diagnose Disk Full
Topic: df/du
---------------------
1. Explore the topic: df/du
2. Mark briefing read: touch /tmp/ts-disk-full-001-read
3. Create completion marker: touch /tmp/ts-disk-full-001-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/ts-disk-full-001-read /tmp/ts-disk-full-001-complete

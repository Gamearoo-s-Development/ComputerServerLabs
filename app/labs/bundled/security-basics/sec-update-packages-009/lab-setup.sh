#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Patch Posture Check
Topic: apt list --upgradable
---------------------
1. Explore the topic: apt list --upgradable
2. Mark briefing read: touch /tmp/sec-update-packages-009-read
3. Create completion marker: touch /tmp/sec-update-packages-009-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/sec-update-packages-009-read /tmp/sec-update-packages-009-complete

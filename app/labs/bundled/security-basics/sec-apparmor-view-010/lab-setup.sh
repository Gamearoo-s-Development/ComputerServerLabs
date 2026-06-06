#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: AppArmor Status (read-only)
Topic: aa-status
---------------------
1. Explore the topic: aa-status
2. Mark briefing read: touch /tmp/sec-apparmor-view-010-read
3. Create completion marker: touch /tmp/sec-apparmor-view-010-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/sec-apparmor-view-010-read /tmp/sec-apparmor-view-010-complete

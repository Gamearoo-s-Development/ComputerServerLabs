#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: chmod Octal Mode
Topic: 755 and 644
---------------------
1. Explore the topic: 755 and 644
2. Mark briefing read: touch /tmp/perm-chmod-octal-004-read
3. Create completion marker: touch /tmp/perm-chmod-octal-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-chmod-octal-004-read /tmp/perm-chmod-octal-004-complete

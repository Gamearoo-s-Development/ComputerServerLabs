#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: chmod Symbolic Mode
Topic: u/g/o permissions
---------------------
1. Explore the topic: u/g/o permissions
2. Mark briefing read: touch /tmp/perm-chmod-symbolic-003-read
3. Create completion marker: touch /tmp/perm-chmod-symbolic-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-chmod-symbolic-003-read /tmp/perm-chmod-symbolic-003-complete

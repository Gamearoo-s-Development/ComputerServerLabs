#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Least Privilege Editing
Topic: sudo for one command
---------------------
1. Explore the topic: sudo for one command
2. Mark briefing read: touch /tmp/perm-sudoers-011-read
3. Create completion marker: touch /tmp/perm-sudoers-011-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-sudoers-011-read /tmp/perm-sudoers-011-complete

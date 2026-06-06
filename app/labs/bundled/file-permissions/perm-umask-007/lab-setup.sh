#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Default Permissions with umask
Topic: creation mask
---------------------
1. Explore the topic: creation mask
2. Mark briefing read: touch /tmp/perm-umask-007-read
3. Create completion marker: touch /tmp/perm-umask-007-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-umask-007-read /tmp/perm-umask-007-complete

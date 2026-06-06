#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Repair Web Root Permissions
Topic: nginx docroot
---------------------
1. Explore the topic: nginx docroot
2. Mark briefing read: touch /tmp/perm-repair-web-015-read
3. Create completion marker: touch /tmp/perm-repair-web-015-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-repair-web-015-read /tmp/perm-repair-web-015-complete

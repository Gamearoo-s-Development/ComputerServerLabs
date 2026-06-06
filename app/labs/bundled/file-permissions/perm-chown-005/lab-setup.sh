#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Change File Owner
Topic: chown basics
---------------------
1. Explore the topic: chown basics
2. Mark briefing read: touch /tmp/perm-chown-005-read
3. Create completion marker: touch /tmp/perm-chown-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-chown-005-read /tmp/perm-chown-005-complete

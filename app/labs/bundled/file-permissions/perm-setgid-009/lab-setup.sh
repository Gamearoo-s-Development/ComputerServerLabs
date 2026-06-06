#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: setgid on Directories
Topic: collaboration dirs
---------------------
1. Explore the topic: collaboration dirs
2. Mark briefing read: touch /tmp/perm-setgid-009-read
3. Create completion marker: touch /tmp/perm-setgid-009-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-setgid-009-read /tmp/perm-setgid-009-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: SUID Awareness (read-only)
Topic: risk identification
---------------------
1. Explore the topic: risk identification
2. Mark briefing read: touch /tmp/perm-suid-awareness-013-read
3. Create completion marker: touch /tmp/perm-suid-awareness-013-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-suid-awareness-013-read /tmp/perm-suid-awareness-013-complete

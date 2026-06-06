#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Special Bits Summary
Topic: suid/sgid/sticky review
---------------------
1. Explore the topic: suid/sgid/sticky review
2. Mark briefing read: touch /tmp/perm-special-bits-014-read
3. Create completion marker: touch /tmp/perm-special-bits-014-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-special-bits-014-read /tmp/perm-special-bits-014-complete

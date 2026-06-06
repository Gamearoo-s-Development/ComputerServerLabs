#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Sticky Bit on /tmp
Topic: shared directories
---------------------
1. Explore the topic: shared directories
2. Mark briefing read: touch /tmp/perm-sticky-008-read
3. Create completion marker: touch /tmp/perm-sticky-008-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-sticky-008-read /tmp/perm-sticky-008-complete

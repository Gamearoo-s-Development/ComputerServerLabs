#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Using man and --help
Topic: documentation
---------------------
1. Explore the topic: documentation
2. Mark briefing read: touch /tmp/linux-man-005-read
3. Create completion marker: touch /tmp/linux-man-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-man-005-read /tmp/linux-man-005-complete

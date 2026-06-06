#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Shell Aliases
Topic: productivity shortcuts
---------------------
1. Explore the topic: productivity shortcuts
2. Mark briefing read: touch /tmp/linux-alias-016-read
3. Create completion marker: touch /tmp/linux-alias-016-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-alias-016-read /tmp/linux-alias-016-complete

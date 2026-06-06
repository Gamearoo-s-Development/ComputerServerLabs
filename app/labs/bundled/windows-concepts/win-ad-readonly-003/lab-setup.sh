#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Read AD Group Membership
Topic: whoami /groups
---------------------
1. Explore the topic: whoami /groups
2. Mark briefing read: touch /tmp/win-ad-readonly-003-read
3. Create completion marker: touch /tmp/win-ad-readonly-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/win-ad-readonly-003-read /tmp/win-ad-readonly-003-complete

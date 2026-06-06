#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Write a Mini Postmortem
Topic: documentation
---------------------
1. Explore the topic: documentation
2. Mark briefing read: touch /tmp/comm-postmortem-005-read
3. Create completion marker: touch /tmp/comm-postmortem-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-postmortem-005-read /tmp/comm-postmortem-005-complete

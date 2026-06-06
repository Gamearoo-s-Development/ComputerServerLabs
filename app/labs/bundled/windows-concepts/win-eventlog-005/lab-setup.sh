#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Event Viewer Patterns
Topic: logon events
---------------------
1. Explore the topic: logon events
2. Mark briefing read: touch /tmp/win-eventlog-005-read
3. Create completion marker: touch /tmp/win-eventlog-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/win-eventlog-005-read /tmp/win-eventlog-005-complete

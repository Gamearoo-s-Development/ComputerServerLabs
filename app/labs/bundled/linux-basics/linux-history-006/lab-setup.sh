#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Command History
Topic: history and recall
---------------------
1. Explore the topic: history and recall
2. Mark briefing read: touch /tmp/linux-history-006-read
3. Create completion marker: touch /tmp/linux-history-006-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-history-006-read /tmp/linux-history-006-complete

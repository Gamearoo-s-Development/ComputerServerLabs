#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Listening Ports with ss
Topic: socket states
---------------------
1. Explore the topic: socket states
2. Mark briefing read: touch /tmp/net-ss-005-read
3. Create completion marker: touch /tmp/net-ss-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-ss-005-read /tmp/net-ss-005-complete

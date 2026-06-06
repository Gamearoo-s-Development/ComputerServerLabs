#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Reachability with ping
Topic: ICMP echo
---------------------
1. Explore the topic: ICMP echo
2. Mark briefing read: touch /tmp/net-ping-003-read
3. Create completion marker: touch /tmp/net-ping-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-ping-003-read /tmp/net-ping-003-complete

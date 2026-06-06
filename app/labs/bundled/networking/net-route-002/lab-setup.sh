#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Default Gateway
Topic: ip route
---------------------
1. Explore the topic: ip route
2. Mark briefing read: touch /tmp/net-route-002-read
3. Create completion marker: touch /tmp/net-route-002-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-route-002-read /tmp/net-route-002-complete

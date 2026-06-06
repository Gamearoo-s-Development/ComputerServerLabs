#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Inspect IP Addresses
Topic: ip addr
---------------------
1. Explore the topic: ip addr
2. Mark briefing read: touch /tmp/net-ip-001-read
3. Create completion marker: touch /tmp/net-ip-001-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-ip-001-read /tmp/net-ip-001-complete

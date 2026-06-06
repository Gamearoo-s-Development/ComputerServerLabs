#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Resolver Configuration
Topic: resolv.conf
---------------------
1. Explore the topic: resolv.conf
2. Mark briefing read: touch /tmp/net-resolv-011-read
3. Create completion marker: touch /tmp/net-resolv-011-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-resolv-011-read /tmp/net-resolv-011-complete

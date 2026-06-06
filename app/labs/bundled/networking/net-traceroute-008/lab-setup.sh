#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Path with traceroute
Topic: hop inspection
---------------------
1. Explore the topic: hop inspection
2. Mark briefing read: touch /tmp/net-traceroute-008-read
3. Create completion marker: touch /tmp/net-traceroute-008-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-traceroute-008-read /tmp/net-traceroute-008-complete

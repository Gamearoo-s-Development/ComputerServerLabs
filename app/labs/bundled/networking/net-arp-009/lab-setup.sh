#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: ARP Table Basics
Topic: L2 neighbors
---------------------
1. Explore the topic: L2 neighbors
2. Mark briefing read: touch /tmp/net-arp-009-read
3. Create completion marker: touch /tmp/net-arp-009-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-arp-009-read /tmp/net-arp-009-complete

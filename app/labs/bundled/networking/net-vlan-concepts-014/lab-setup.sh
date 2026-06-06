#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: VLAN Concepts (theory)
Topic: 802.1Q basics
---------------------
1. Explore the topic: 802.1Q basics
2. Mark briefing read: touch /tmp/net-vlan-concepts-014-read
3. Create completion marker: touch /tmp/net-vlan-concepts-014-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-vlan-concepts-014-read /tmp/net-vlan-concepts-014-complete

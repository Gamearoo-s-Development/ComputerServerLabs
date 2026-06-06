#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: NAT Concepts
Topic: SNAT/DNAT reading
---------------------
1. Explore the topic: SNAT/DNAT reading
2. Mark briefing read: touch /tmp/net-nat-concepts-013-read
3. Create completion marker: touch /tmp/net-nat-concepts-013-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-nat-concepts-013-read /tmp/net-nat-concepts-013-complete

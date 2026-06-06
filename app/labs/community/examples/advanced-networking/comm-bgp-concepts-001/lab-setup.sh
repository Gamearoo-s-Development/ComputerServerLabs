#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: BGP Concepts Lab
Topic: path attributes
---------------------
1. Explore the topic: path attributes
2. Mark briefing read: touch /tmp/comm-bgp-concepts-001-read
3. Create completion marker: touch /tmp/comm-bgp-concepts-001-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-bgp-concepts-001-read /tmp/comm-bgp-concepts-001-complete

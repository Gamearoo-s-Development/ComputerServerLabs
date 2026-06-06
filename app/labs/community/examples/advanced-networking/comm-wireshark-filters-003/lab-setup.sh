#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Wireshark Display Filters
Topic: capture analysis
---------------------
1. Explore the topic: capture analysis
2. Mark briefing read: touch /tmp/comm-wireshark-filters-003-read
3. Create completion marker: touch /tmp/comm-wireshark-filters-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-wireshark-filters-003-read /tmp/comm-wireshark-filters-003-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Read a tcpdump Capture
Topic: pcap analysis
---------------------
1. Explore the topic: pcap analysis
2. Mark briefing read: touch /tmp/net-capture-readonly-015-read
3. Create completion marker: touch /tmp/net-capture-readonly-015-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-capture-readonly-015-read /tmp/net-capture-readonly-015-complete

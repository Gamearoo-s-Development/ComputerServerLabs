#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Download Artifacts
Topic: wget basics
---------------------
1. Explore the topic: wget basics
2. Mark briefing read: touch /tmp/net-wget-007-read
3. Create completion marker: touch /tmp/net-wget-007-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-wget-007-read /tmp/net-wget-007-complete

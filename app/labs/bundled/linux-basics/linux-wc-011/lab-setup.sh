#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Count Lines and Words
Topic: wc utility
---------------------
1. Explore the topic: wc utility
2. Mark briefing read: touch /tmp/linux-wc-011-read
3. Create completion marker: touch /tmp/linux-wc-011-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-wc-011-read /tmp/linux-wc-011-complete

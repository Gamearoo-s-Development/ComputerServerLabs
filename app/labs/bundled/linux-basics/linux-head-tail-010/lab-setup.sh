#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: head and tail
Topic: log snippets
---------------------
1. Explore the topic: log snippets
2. Mark briefing read: touch /tmp/linux-head-tail-010-read
3. Create completion marker: touch /tmp/linux-head-tail-010-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-head-tail-010-read /tmp/linux-head-tail-010-complete

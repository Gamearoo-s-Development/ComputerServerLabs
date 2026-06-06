#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Extract Columns with cut
Topic: field parsing
---------------------
1. Explore the topic: field parsing
2. Mark briefing read: touch /tmp/linux-cut-013-read
3. Create completion marker: touch /tmp/linux-cut-013-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-cut-013-read /tmp/linux-cut-013-complete

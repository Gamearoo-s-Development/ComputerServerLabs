#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Serve Static Files
Topic: index.html
---------------------
1. Explore the topic: index.html
2. Mark briefing read: touch /tmp/web-static-004-read
3. Create completion marker: touch /tmp/web-static-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/web-static-004-read /tmp/web-static-004-complete

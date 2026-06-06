#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Start nginx
Topic: systemctl/nginx
---------------------
1. Explore the topic: systemctl/nginx
2. Mark briefing read: touch /tmp/web-nginx-start-002-read
3. Create completion marker: touch /tmp/web-nginx-start-002-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/web-nginx-start-002-read /tmp/web-nginx-start-002-complete

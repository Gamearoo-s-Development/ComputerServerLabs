#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Reverse Proxy Intro
Topic: proxy_pass
---------------------
1. Explore the topic: proxy_pass
2. Mark briefing read: touch /tmp/web-reverse-proxy-007-read
3. Create completion marker: touch /tmp/web-reverse-proxy-007-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/web-reverse-proxy-007-read /tmp/web-reverse-proxy-007-complete

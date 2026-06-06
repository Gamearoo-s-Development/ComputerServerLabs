#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: HTTP Headers with curl
Topic: curl -I
---------------------
1. Explore the topic: curl -I
2. Mark briefing read: touch /tmp/net-curl-006-read
3. Create completion marker: touch /tmp/net-curl-006-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-curl-006-read /tmp/net-curl-006-complete

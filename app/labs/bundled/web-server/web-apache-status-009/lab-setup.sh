#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Apache Status Page
Topic: mod_status
---------------------
1. Explore the topic: mod_status
2. Mark briefing read: touch /tmp/web-apache-status-009-read
3. Create completion marker: touch /tmp/web-apache-status-009-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/web-apache-status-009-read /tmp/web-apache-status-009-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: WAF Log Review
Topic: blocked requests
---------------------
1. Explore the topic: blocked requests
2. Mark briefing read: touch /tmp/comm-waf-logs-005-read
3. Create completion marker: touch /tmp/comm-waf-logs-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-waf-logs-005-read /tmp/comm-waf-logs-005-complete

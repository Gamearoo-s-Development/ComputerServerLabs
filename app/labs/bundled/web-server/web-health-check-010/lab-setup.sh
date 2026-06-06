#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: HTTP Health Checks
Topic: /health endpoint
---------------------
1. Explore the topic: /health endpoint
2. Mark briefing read: touch /tmp/web-health-check-010-read
3. Create completion marker: touch /tmp/web-health-check-010-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/web-health-check-010-read /tmp/web-health-check-010-complete

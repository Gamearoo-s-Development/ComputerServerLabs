#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Service Will Not Start
Topic: journalctl
---------------------
1. Explore the topic: journalctl
2. Mark briefing read: touch /tmp/ts-service-down-002-read
3. Create completion marker: touch /tmp/ts-service-down-002-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/ts-service-down-002-read /tmp/ts-service-down-002-complete

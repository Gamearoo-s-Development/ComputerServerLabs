#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Load Balancer Health
Topic: backend probes
---------------------
1. Explore the topic: backend probes
2. Mark briefing read: touch /tmp/comm-lb-health-005-read
3. Create completion marker: touch /tmp/comm-lb-health-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-lb-health-005-read /tmp/comm-lb-health-005-complete

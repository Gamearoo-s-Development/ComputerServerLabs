#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Container Image Labels
Topic: supply chain
---------------------
1. Explore the topic: supply chain
2. Mark briefing read: touch /tmp/comm-container-scan-004-read
3. Create completion marker: touch /tmp/comm-container-scan-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-container-scan-004-read /tmp/comm-container-scan-004-complete

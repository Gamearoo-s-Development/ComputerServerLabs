#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Registry Mirror Concepts
Topic: pull policy
---------------------
1. Explore the topic: pull policy
2. Mark briefing read: touch /tmp/comm-registry-mirror-003-read
3. Create completion marker: touch /tmp/comm-registry-mirror-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-registry-mirror-003-read /tmp/comm-registry-mirror-003-complete

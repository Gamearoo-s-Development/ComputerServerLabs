#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Environment Variables
Topic: env and export
---------------------
1. Explore the topic: env and export
2. Mark briefing read: touch /tmp/linux-env-015-read
3. Create completion marker: touch /tmp/linux-env-015-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-env-015-read /tmp/linux-env-015-complete

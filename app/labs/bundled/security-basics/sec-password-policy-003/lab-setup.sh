#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Password Policy Reading
Topic: login.defs
---------------------
1. Explore the topic: login.defs
2. Mark briefing read: touch /tmp/sec-password-policy-003-read
3. Create completion marker: touch /tmp/sec-password-policy-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/sec-password-policy-003-read /tmp/sec-password-policy-003-complete

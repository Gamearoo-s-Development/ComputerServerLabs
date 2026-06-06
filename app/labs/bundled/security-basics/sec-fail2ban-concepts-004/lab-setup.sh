#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: fail2ban Concepts
Topic: ban rules
---------------------
1. Explore the topic: ban rules
2. Mark briefing read: touch /tmp/sec-fail2ban-concepts-004-read
3. Create completion marker: touch /tmp/sec-fail2ban-concepts-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/sec-fail2ban-concepts-004-read /tmp/sec-fail2ban-concepts-004-complete

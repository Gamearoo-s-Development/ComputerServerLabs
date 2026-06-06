#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Default Deny Mindset
Topic: ufw status
---------------------
1. Explore the topic: ufw status
2. Mark briefing read: touch /tmp/sec-firewall-default-008-read
3. Create completion marker: touch /tmp/sec-firewall-default-008-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/sec-firewall-default-008-read /tmp/sec-firewall-default-008-complete

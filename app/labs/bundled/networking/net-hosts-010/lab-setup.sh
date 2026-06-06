#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Static Hostname Mapping
Topic: /etc/hosts
---------------------
1. Explore the topic: /etc/hosts
2. Mark briefing read: touch /tmp/net-hosts-010-read
3. Create completion marker: touch /tmp/net-hosts-010-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-hosts-010-read /tmp/net-hosts-010-complete

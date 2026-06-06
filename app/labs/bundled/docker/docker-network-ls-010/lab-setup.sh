#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Docker Networks
Topic: bridge networks
---------------------
1. Explore the topic: bridge networks
2. Mark briefing read: touch /tmp/docker-network-ls-010-read
3. Create completion marker: touch /tmp/docker-network-ls-010-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-network-ls-010-read /tmp/docker-network-ls-010-complete

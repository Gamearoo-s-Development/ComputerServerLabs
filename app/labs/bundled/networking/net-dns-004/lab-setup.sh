#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: DNS Lookup
Topic: dig/host/nslookup
---------------------
1. Explore the topic: dig/host/nslookup
2. Mark briefing read: touch /tmp/net-dns-004-read
3. Create completion marker: touch /tmp/net-dns-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/net-dns-004-read /tmp/net-dns-004-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: IPsec Policy Review
Topic: policy read-only
---------------------
1. Explore the topic: policy read-only
2. Mark briefing read: touch /tmp/comm-ipsec-read-002-read
3. Create completion marker: touch /tmp/comm-ipsec-read-002-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-ipsec-read-002-read /tmp/comm-ipsec-read-002-complete

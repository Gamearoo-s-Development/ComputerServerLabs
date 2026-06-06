#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Certificate Expiry Check
Topic: openssl s_client
---------------------
1. Explore the topic: openssl s_client
2. Mark briefing read: touch /tmp/ts-cert-expiry-010-read
3. Create completion marker: touch /tmp/ts-cert-expiry-010-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/ts-cert-expiry-010-read /tmp/ts-cert-expiry-010-complete

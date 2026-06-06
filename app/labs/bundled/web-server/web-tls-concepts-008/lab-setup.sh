#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: TLS Termination Concepts
Topic: cert paths
---------------------
1. Explore the topic: cert paths
2. Mark briefing read: touch /tmp/web-tls-concepts-008-read
3. Create completion marker: touch /tmp/web-tls-concepts-008-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/web-tls-concepts-008-read /tmp/web-tls-concepts-008-complete

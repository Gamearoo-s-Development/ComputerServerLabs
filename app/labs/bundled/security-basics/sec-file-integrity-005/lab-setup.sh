#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Find Changed Files
Topic: checksum audit
---------------------
1. Explore the topic: checksum audit
2. Mark briefing read: touch /tmp/sec-file-integrity-005-read
3. Create completion marker: touch /tmp/sec-file-integrity-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/sec-file-integrity-005-read /tmp/sec-file-integrity-005-complete

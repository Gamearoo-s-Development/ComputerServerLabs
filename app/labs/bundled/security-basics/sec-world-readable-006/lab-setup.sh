#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Audit Sensitive Files
Topic: permission sweep
---------------------
1. Explore the topic: permission sweep
2. Mark briefing read: touch /tmp/sec-world-readable-006-read
3. Create completion marker: touch /tmp/sec-world-readable-006-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/sec-world-readable-006-read /tmp/sec-world-readable-006-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Find World-Writable Files
Topic: audit hygiene
---------------------
1. Explore the topic: audit hygiene
2. Mark briefing read: touch /tmp/perm-world-writable-012-read
3. Create completion marker: touch /tmp/perm-world-writable-012-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-world-writable-012-read /tmp/perm-world-writable-012-complete

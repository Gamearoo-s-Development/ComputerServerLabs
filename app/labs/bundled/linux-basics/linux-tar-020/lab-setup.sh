#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Archive with tar
Topic: backups
---------------------
1. Explore the topic: backups
2. Mark briefing read: touch /tmp/linux-tar-020-read
3. Create completion marker: touch /tmp/linux-tar-020-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-tar-020-read /tmp/linux-tar-020-complete

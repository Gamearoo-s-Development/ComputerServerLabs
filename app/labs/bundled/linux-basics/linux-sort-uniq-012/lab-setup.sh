#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: sort and uniq
Topic: log deduplication
---------------------
1. Explore the topic: log deduplication
2. Mark briefing read: touch /tmp/linux-sort-uniq-012-read
3. Create completion marker: touch /tmp/linux-sort-uniq-012-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-sort-uniq-012-read /tmp/linux-sort-uniq-012-complete

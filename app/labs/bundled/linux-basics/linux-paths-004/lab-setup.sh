#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Absolute vs Relative Paths
Topic: path resolution
---------------------
1. Explore the topic: path resolution
2. Mark briefing read: touch /tmp/linux-paths-004-read
3. Create completion marker: touch /tmp/linux-paths-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-paths-004-read /tmp/linux-paths-004-complete

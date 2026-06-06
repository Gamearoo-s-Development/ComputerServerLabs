#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: awk Introduction
Topic: column reports
---------------------
1. Explore the topic: column reports
2. Mark briefing read: touch /tmp/linux-awk-intro-014-read
3. Create completion marker: touch /tmp/linux-awk-intro-014-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-awk-intro-014-read /tmp/linux-awk-intro-014-complete

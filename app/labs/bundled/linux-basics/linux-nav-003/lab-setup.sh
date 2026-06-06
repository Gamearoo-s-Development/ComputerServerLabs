#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Directory Navigation
Topic: cd, pwd, and ls
---------------------
1. Explore the topic: cd, pwd, and ls
2. Mark briefing read: touch /tmp/linux-nav-003-read
3. Create completion marker: touch /tmp/linux-nav-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-nav-003-read /tmp/linux-nav-003-complete

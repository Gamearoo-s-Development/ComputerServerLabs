#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Pipes and Redirection
Topic: stdout/stderr
---------------------
1. Explore the topic: stdout/stderr
2. Mark briefing read: touch /tmp/linux-pipes-007-read
3. Create completion marker: touch /tmp/linux-pipes-007-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/linux-pipes-007-read /tmp/linux-pipes-007-complete

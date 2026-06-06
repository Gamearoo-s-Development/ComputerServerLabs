#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Stop and Remove
Topic: lifecycle
---------------------
1. Explore the topic: lifecycle
2. Mark briefing read: touch /tmp/docker-stop-rm-008-read
3. Create completion marker: touch /tmp/docker-stop-rm-008-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-stop-rm-008-read /tmp/docker-stop-rm-008-complete

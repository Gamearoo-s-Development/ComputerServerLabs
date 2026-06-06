#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Tag an Image
Topic: registry naming
---------------------
1. Explore the topic: registry naming
2. Mark briefing read: touch /tmp/docker-tag-015-read
3. Create completion marker: touch /tmp/docker-tag-015-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-tag-015-read /tmp/docker-tag-015-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Inspect Metadata
Topic: docker inspect
---------------------
1. Explore the topic: docker inspect
2. Mark briefing read: touch /tmp/docker-inspect-009-read
3. Create completion marker: touch /tmp/docker-inspect-009-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-inspect-009-read /tmp/docker-inspect-009-complete

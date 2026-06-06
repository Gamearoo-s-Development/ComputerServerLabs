#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Run an Ephemeral Container
Topic: docker run flags
---------------------
1. Explore the topic: docker run flags
2. Mark briefing read: touch /tmp/docker-run-007-read
3. Create completion marker: touch /tmp/docker-run-007-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/docker-run-007-read /tmp/docker-run-007-complete

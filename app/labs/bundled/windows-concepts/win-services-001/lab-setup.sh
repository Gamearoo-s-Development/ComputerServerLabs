#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Windows Services Concepts
Topic: services.msc mapping
---------------------
1. Explore the topic: services.msc mapping
2. Mark briefing read: touch /tmp/win-services-001-read
3. Create completion marker: touch /tmp/win-services-001-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/win-services-001-read /tmp/win-services-001-complete

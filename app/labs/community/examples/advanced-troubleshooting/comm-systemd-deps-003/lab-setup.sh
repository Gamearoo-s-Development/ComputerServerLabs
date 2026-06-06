#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: systemd Dependency Cycle
Topic: systemctl list-dependencies
---------------------
1. Explore the topic: systemctl list-dependencies
2. Mark briefing read: touch /tmp/comm-systemd-deps-003-read
3. Create completion marker: touch /tmp/comm-systemd-deps-003-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-systemd-deps-003-read /tmp/comm-systemd-deps-003-complete

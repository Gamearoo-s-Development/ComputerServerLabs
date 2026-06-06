#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Container Resource Limits
Topic: cpus/mem
---------------------
1. Explore the topic: cpus/mem
2. Mark briefing read: touch /tmp/comm-cgroup-limits-004-read
3. Create completion marker: touch /tmp/comm-cgroup-limits-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-cgroup-limits-004-read /tmp/comm-cgroup-limits-004-complete

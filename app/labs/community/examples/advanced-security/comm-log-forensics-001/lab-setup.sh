#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Log Timeline Correlation
Topic: incident triage
---------------------
1. Explore the topic: incident triage
2. Mark briefing read: touch /tmp/comm-log-forensics-001-read
3. Create completion marker: touch /tmp/comm-log-forensics-001-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-log-forensics-001-read /tmp/comm-log-forensics-001-complete

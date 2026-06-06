#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: User Grants (least privilege)
Topic: GRANT
---------------------
1. Explore the topic: GRANT
2. Mark briefing read: touch /tmp/db-user-grants-007-read
3. Create completion marker: touch /tmp/db-user-grants-007-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/db-user-grants-007-read /tmp/db-user-grants-007-complete

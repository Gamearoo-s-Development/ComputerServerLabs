#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Logical Backup
Topic: mysqldump
---------------------
1. Explore the topic: mysqldump
2. Mark briefing read: touch /tmp/db-backup-005-read
3. Create completion marker: touch /tmp/db-backup-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/db-backup-005-read /tmp/db-backup-005-complete

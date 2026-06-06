#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Encrypted Backup Concepts
Topic: at-rest
---------------------
1. Explore the topic: at-rest
2. Mark briefing read: touch /tmp/comm-backup-encrypt-005-read
3. Create completion marker: touch /tmp/comm-backup-encrypt-005-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-backup-encrypt-005-read /tmp/comm-backup-encrypt-005-complete

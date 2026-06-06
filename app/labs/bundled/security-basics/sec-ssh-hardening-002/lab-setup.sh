#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: SSH Config Review
Topic: sshd_config
---------------------
1. Explore the topic: sshd_config
2. Mark briefing read: touch /tmp/sec-ssh-hardening-002-read
3. Create completion marker: touch /tmp/sec-ssh-hardening-002-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/sec-ssh-hardening-002-read /tmp/sec-ssh-hardening-002-complete

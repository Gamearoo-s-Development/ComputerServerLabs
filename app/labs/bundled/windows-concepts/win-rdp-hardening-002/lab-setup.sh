#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: RDP Hardening Checklist
Topic: NLA concepts
---------------------
1. Explore the topic: NLA concepts
2. Mark briefing read: touch /tmp/win-rdp-hardening-002-read
3. Create completion marker: touch /tmp/win-rdp-hardening-002-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/win-rdp-hardening-002-read /tmp/win-rdp-hardening-002-complete

#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: ACL Basics
Topic: getfacl/setfacl
---------------------
1. Explore the topic: getfacl/setfacl
2. Mark briefing read: touch /tmp/perm-acl-intro-010-read
3. Create completion marker: touch /tmp/perm-acl-intro-010-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-acl-intro-010-read /tmp/perm-acl-intro-010-complete

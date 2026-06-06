#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Shell Basics
---------------------
You are already logged into this training server from the lab terminal.

1. Run: whoami
2. Run: pwd
3. After reading this file, run: touch /tmp/shell-basics-read
4. Create an empty completion marker under /tmp/.
   Marker basename: mission-complete
   (figure out the full path and how to create an empty file)

When the marker exists, use Validate / Check in the app.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/shell-basics-read /tmp/mission-complete

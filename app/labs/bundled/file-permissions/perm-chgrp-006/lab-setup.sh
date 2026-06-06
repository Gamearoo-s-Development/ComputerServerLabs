#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Change Group Ownership
Topic: chgrp
---------------------
1. Explore the topic: chgrp
2. Mark briefing read: touch /tmp/perm-chgrp-006-read
3. Create completion marker: touch /tmp/perm-chgrp-006-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/perm-chgrp-006-read /tmp/perm-chgrp-006-complete

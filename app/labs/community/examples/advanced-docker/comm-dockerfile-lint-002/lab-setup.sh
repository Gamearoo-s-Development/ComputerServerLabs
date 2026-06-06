#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: Dockerfile Best Practices
Topic: layer hygiene
---------------------
1. Explore the topic: layer hygiene
2. Mark briefing read: touch /tmp/comm-dockerfile-lint-002-read
3. Create completion marker: touch /tmp/comm-dockerfile-lint-002-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-dockerfile-lint-002-read /tmp/comm-dockerfile-lint-002-complete

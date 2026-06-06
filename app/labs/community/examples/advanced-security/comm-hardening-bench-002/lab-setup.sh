#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: CIS Benchmark Reading
Topic: control mapping
---------------------
1. Explore the topic: control mapping
2. Mark briefing read: touch /tmp/comm-hardening-bench-002-read
3. Create completion marker: touch /tmp/comm-hardening-bench-002-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/comm-hardening-bench-002-read /tmp/comm-hardening-bench-002-complete

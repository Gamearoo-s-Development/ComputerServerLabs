#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: PowerShell Get-Help
Topic: cmdlet discovery
---------------------
1. Explore the topic: cmdlet discovery
2. Mark briefing read: touch /tmp/win-powershell-help-004-read
3. Create completion marker: touch /tmp/win-powershell-help-004-complete

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f /tmp/win-powershell-help-004-read /tmp/win-powershell-help-004-complete

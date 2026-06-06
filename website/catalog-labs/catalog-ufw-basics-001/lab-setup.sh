#!/bin/bash
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"

if command -v sudo >/dev/null 2>&1; then
  getent group sudo >/dev/null 2>&1 && usermod -aG sudo "$u" 2>/dev/null || true
fi

cat >"$home/README.txt" <<'EOF'
Mission: Host Firewall with UFW
---------------------------------
You are on a training server with UFW installed but not configured yet.

1. Check status: ufw status
2. Allow OpenSSH and TCP port 80 before enabling the firewall
   (e.g. sudo ufw allow OpenSSH && sudo ufw allow 80/tcp)
3. Enable UFW (e.g. sudo ufw --force enable)
4. Confirm with: ufw status numbered

Click Check in the app when objectives turn complete.
EOF

chown "$u:$u" "$home/README.txt" 2>/dev/null || true

ufw --force disable >/dev/null 2>&1 || true

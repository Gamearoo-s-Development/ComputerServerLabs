#!/bin/bash
set -euo pipefail

if [ -f /usr/local/bin/apply-lab-credentials.sh ]; then
  # shellcheck source=/dev/null
  . /usr/local/bin/apply-lab-credentials.sh
fi

if type apply_lab_credentials >/dev/null 2>&1; then
  apply_lab_credentials
  configure_mission_sshd
fi

u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"
if [ -n "$u" ] && [ -f /var/www/config/app.conf ]; then
  chown "$u:$u" /var/www/config/app.conf 2>/dev/null || true
fi

if [ -f /usr/local/bin/configure-lab-ssh-access.sh ]; then
  # shellcheck source=/dev/null
  . /usr/local/bin/configure-lab-ssh-access.sh
  configure_lab_ssh_access
fi

if [ -f /usr/local/bin/start-lab-sshd.sh ]; then
  # shellcheck source=/dev/null
  . /usr/local/bin/start-lab-sshd.sh
  start_lab_sshd
fi
exec /usr/sbin/sshd -D -e

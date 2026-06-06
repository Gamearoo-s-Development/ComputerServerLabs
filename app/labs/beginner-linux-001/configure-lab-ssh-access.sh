#!/bin/bash
# Legacy hook — SSH is not restricted by source IP, token, or ForceCommand.
# Security comes from Docker isolation (private networks, no host mounts).
set -euo pipefail

configure_lab_ssh_access() {
  local dropin="/etc/ssh/sshd_config.d/99-sysadmin-game-lab.conf"
  if [ -f "$dropin" ]; then
    sed -i '/^ForceCommand /d;/^AcceptEnv LAB_SSH_ACCESS_TOKEN/d' "$dropin" 2>/dev/null || true
  fi
  rm -f /etc/lab/ssh-login-guard.sh /etc/lab/access-token /etc/lab/allowed-helper-ip 2>/dev/null || true
  return 0
}

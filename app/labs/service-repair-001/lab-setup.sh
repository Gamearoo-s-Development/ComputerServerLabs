#!/bin/bash
# service-repair-001 — sudo for session user + broken systemd unit scenario
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"
if [ -n "$u" ]; then
  usermod -aG sudo "$u" 2>/dev/null || true
  echo "${u} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/lab-session-user
  chmod 440 /etc/sudoers.d/lab-session-user
fi

mode="${LAB_FAILURE_MODE:-missing_exec}"
unit="/etc/systemd/system/training-agent.service"
run_sh="/opt/training-agent/run.sh"
case "$mode" in
  bad_permissions)
    chmod 000 "$run_sh" ;;
  wrong_user)
    sed -i 's/^ExecStart=.*/ExecStart=\/opt\/training-agent\/run.sh/' "$unit"
    sed -i '/^\[Service\]/a User=nobody' "$unit" ;;
  broken_env)
    sed -i 's|^ExecStart=.*|ExecStart=/opt/training-agent/broken-start.sh|' "$unit" ;;
  disabled_service)
    rm -f /etc/systemd/system/multi-user.target.wants/training-agent.service 2>/dev/null || true ;;
  missing_exec|*)
    sed -i 's|^ExecStart=.*|ExecStart=/opt/training-agent/broken-start.sh|' "$unit" ;;
esac

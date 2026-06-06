#!/bin/bash

set -euo pipefail



if [ -f /usr/local/bin/apply-lab-credentials.sh ]; then
  # shellcheck source=/dev/null
  . /usr/local/bin/apply-lab-credentials.sh
fi

apply_service_failure() {

  local mode="${LAB_FAILURE_MODE:-missing_exec}"

  local unit="/etc/systemd/system/training-agent.service"

  local run_sh="/opt/training-agent/run.sh"

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

}



if type apply_lab_credentials >/dev/null 2>&1; then
  apply_lab_credentials
  configure_mission_sshd
fi

apply_service_failure

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



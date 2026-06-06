#!/bin/bash

set -euo pipefail



if [ -f /usr/local/bin/apply-lab-credentials.sh ]; then
  # shellcheck source=/dev/null
  . /usr/local/bin/apply-lab-credentials.sh
fi

apply_nginx_failure() {

  local mode="${LAB_FAILURE_MODE:-syntax_typo}"

  local conf="/etc/nginx/sites-available/training.conf"

  case "$mode" in

    bad_listen)

      sed -i 's/listen 80;/listen 8080;/' "$conf" ;;

    broken_include)

      printf '%s\n' 'include /etc/nginx/missing-training.conf;' >> "$conf" ;;

    missing_index)

      sed -i 's/return 200/return 404/' "$conf" ;;

    wrong_permissions)

      chmod 000 "$conf" ;;

    syntax_typo|*)

      sed -i 's/listen 80;/listen 80/' "$conf" ;;

  esac

}



if type apply_lab_credentials >/dev/null 2>&1; then
  apply_lab_credentials
  configure_mission_sshd
fi

apply_nginx_failure

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



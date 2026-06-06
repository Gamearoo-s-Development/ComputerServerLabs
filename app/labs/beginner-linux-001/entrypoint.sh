#!/bin/bash

set -euo pipefail



if [ -f /usr/local/bin/apply-lab-credentials.sh ]; then

  # shellcheck source=/dev/null

  . /usr/local/bin/apply-lab-credentials.sh

fi



apply_session_decoys() {

  local user_home="$1"

  local u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"

  [ -n "${LAB_ACTIVE_DECOYS:-}" ] || return 0

  local old_ifs=$IFS

  IFS=,

  for decoy_id in $LAB_ACTIVE_DECOYS; do

    case "$decoy_id" in

      old_backup)

        printf '%s\n' "Old backup notes (decoy)." > "${user_home}/.old_backup" 2>/dev/null || true ;;

      readme)

        printf '%s\n' "Welcome user." > "${user_home}/readme.txt" 2>/dev/null || true ;;

      training_log)

        mkdir -p /var/log 2>/dev/null || true

        printf '%s\n' "[training] Warning: unrelated log entry." > /var/log/training-warning.log 2>/dev/null || true ;;

      fake_flag)

        printf '%s\n' "DECOY-FLAG" > "${user_home}/.old_flag" 2>/dev/null || true ;;

      stale_config)

        mkdir -p /etc/training 2>/dev/null || true

        printf '%s\n' "# stale decoy" > /etc/training/stale.conf 2>/dev/null || true ;;

      cron_hint)

        mkdir -p /var/log 2>/dev/null || true

        printf '%s\n' "[training] cron idle (decoy)." > /var/log/cron-training.log 2>/dev/null || true ;;

    esac

  done

  IFS=$old_ifs

  [ -n "$u" ] && chown -R "${u}:${u}" "$user_home" 2>/dev/null || true

}



if type apply_lab_credentials >/dev/null 2>&1; then

  apply_lab_credentials

  configure_mission_sshd

fi



u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"

user_home="$(getent passwd "$u" 2>/dev/null | cut -d: -f6 || true)"

[ -z "${user_home:-}" ] && [ -n "$u" ] && user_home="/home/$u"

[ -n "${user_home:-}" ] && apply_session_decoys "$user_home"



setup_objectives() {

  local flag_path="${LAB_FLAG_PATH:-}"

  if [ -z "${flag_path:-}" ] && [ -n "$u" ]; then

    flag_path="${user_home}/${LAB_FLAG_BASENAME:-.hidden_flag}"

  fi



  if [ -n "${LAB_TRAINING_FLAG:-}" ] && [ -n "${flag_path:-}" ]; then

    mkdir -p "$(dirname "$flag_path")" 2>/dev/null || true

    printf '%s\n' "Congratulations — you found the hidden training flag." "Flag: ${LAB_TRAINING_FLAG}" > "$flag_path" || true

    [ -n "$u" ] && chown "${u}:${u}" "$flag_path" 2>/dev/null || true

    chmod 600 "$flag_path" 2>/dev/null || true

  fi

}



if [ -f /usr/local/bin/configure-lab-ssh-access.sh ]; then

  # shellcheck source=/dev/null

  . /usr/local/bin/configure-lab-ssh-access.sh

  configure_lab_ssh_access

fi



setup_objectives

if [ -f /usr/local/bin/start-lab-sshd.sh ]; then
  # shellcheck source=/dev/null
  . /usr/local/bin/start-lab-sshd.sh
  start_lab_sshd
fi

exec /usr/sbin/sshd -D -e


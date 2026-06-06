#!/bin/bash
# beginner-linux-001 — session decoys and hidden flag under /home/$SGQ_USERNAME
set -euo pipefail

if [ -f /usr/local/bin/apply-lab-credentials.sh ]; then
  # shellcheck source=/dev/null
  . /usr/local/bin/apply-lab-credentials.sh
  install_lab_session_helpers || true
fi

u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"
[ -n "$u" ] || exit 0

user_home="$(getent passwd "$u" | cut -d: -f6 || true)"
[ -n "${user_home:-}" ] || user_home="/home/$u"
mkdir -p "$user_home"
chown -R "$u:$u" "$user_home" 2>/dev/null || true

apply_session_decoys() {
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
  chown -R "${u}:${u}" "$user_home" 2>/dev/null || true
}

apply_session_decoys

flag_path="${LAB_FLAG_PATH:-}"
if [ -z "${flag_path:-}" ]; then
  flag_path="${user_home}/${LAB_FLAG_BASENAME:-.hidden_flag}"
fi

if [ -n "${LAB_TRAINING_FLAG:-}" ] && [ -n "${flag_path:-}" ]; then
  mkdir -p "$(dirname "$flag_path")" 2>/dev/null || true
  printf '%s\n' "Congratulations — you found the hidden training flag." "Flag: ${LAB_TRAINING_FLAG}" > "$flag_path" || true
  chown "${u}:${u}" "$flag_path" 2>/dev/null || true
  chmod 600 "$flag_path" 2>/dev/null || true
  if [ ! -f "$flag_path" ]; then
    echo "lab-setup: failed to create training flag at ${flag_path}" >&2
    exit 1
  fi
  echo "lab-setup: training flag ready at ${flag_path}"
fi

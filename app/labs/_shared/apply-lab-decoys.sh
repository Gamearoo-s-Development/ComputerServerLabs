#!/bin/sh
# Apply session-selected decoys (LAB_ACTIVE_DECOYS comma-separated ids).
set -eu

apply_decoy() {
  id="$1"
  user_home="$2"
  case "$id" in
    old_backup)
      printf '%s\n' "Old backup notes (decoy)." "Nothing important here." > "${user_home}/.old_backup" 2>/dev/null || true
      chmod 600 "${user_home}/.old_backup" 2>/dev/null || true
      ;;
    readme)
      printf '%s\n' "Welcome user." "This file may or may not be relevant." > "${user_home}/readme.txt" 2>/dev/null || true
      chmod 644 "${user_home}/readme.txt" 2>/dev/null || true
      ;;
    training_log)
      mkdir -p /var/log 2>/dev/null || true
      printf '%s\n' "[training] Warning: legacy subsystem reported a non-fatal issue." > /var/log/training-warning.log 2>/dev/null || true
      chmod 644 /var/log/training-warning.log 2>/dev/null || true
      ;;
    fake_flag)
      printf '%s\n' "DECOY-FLAG-NOT-REAL" > "${user_home}/.old_flag" 2>/dev/null || true
      chmod 600 "${user_home}/.old_flag" 2>/dev/null || true
      ;;
    stale_config)
      mkdir -p /etc/training 2>/dev/null || true
      printf '%s\n' "# stale decoy config" "enable_legacy=false" > /etc/training/stale.conf 2>/dev/null || true
      ;;
    cron_hint)
      mkdir -p /var/log 2>/dev/null || true
      printf '%s\n' "[training] cron subsystem idle (decoy)." > /var/log/cron-training.log 2>/dev/null || true
      ;;
    *)
      ;;
  esac
}

user_home="$(getent passwd "${LAB_USERNAME:-student}" | cut -d: -f6 || true)"
if [ -z "${user_home:-}" ]; then
  user_home="/home/${LAB_USERNAME:-student}"
fi

if [ -n "${LAB_ACTIVE_DECOYS:-}" ]; then
  old_ifs=$IFS
  IFS=,
  for decoy_id in $LAB_ACTIVE_DECOYS; do
    apply_decoy "$decoy_id" "$user_home"
  done
  IFS=$old_ifs
  chown -R "${LAB_USERNAME:-student}:${LAB_USERNAME:-student}" "$user_home" 2>/dev/null || true
fi

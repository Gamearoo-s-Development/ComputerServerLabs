#!/bin/bash
# nginx-001 — sudo for session user + broken nginx config scenario
set -euo pipefail

u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"
if [ -n "$u" ]; then
  usermod -aG sudo "$u" 2>/dev/null || true
  echo "${u} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/lab-session-user
  chmod 440 /etc/sudoers.d/lab-session-user
fi

mode="${LAB_FAILURE_MODE:-syntax_typo}"
conf="/etc/nginx/sites-available/training.conf"
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

#!/bin/bash
# Container-safe workstation login setup (password, shell, TTY login banner, minimal PAM).
set -euo pipefail

configure_workstation_login() {
  local u="${1:-}"
  local p="${2:-}"
  local hostname="${3:-lab-workstation}"
  local distro="${4:-Linux}"
  local home_dir="${5:-}"
  local shell_path="${6:-/bin/bash}"

  [ -n "$u" ] || return 0

  if ! id "$u" >/dev/null 2>&1; then
    useradd -m -s "$shell_path" -d "${home_dir:-/home/$u}" "$u"
  fi

  [ -n "${home_dir:-}" ] || home_dir="/home/$u"
  mkdir -p "$home_dir"
  chown "${u}:${u}" "$home_dir"

  if [ -n "$p" ]; then
    if ! printf '%s:%s\n' "$u" "$p" | chpasswd 2>/tmp/sgq-chpasswd.err; then
      cat /tmp/sgq-chpasswd.err >&2 2>/dev/null || true
    fi
    passwd -u "$u" 2>/dev/null || true
    usermod -U "$u" 2>/dev/null || true
  fi

  if command -v usermod >/dev/null 2>&1; then
    usermod -s "$shell_path" -d "$home_dir" "$u" 2>/dev/null || usermod -s "$shell_path" "$u" 2>/dev/null || true
  fi

  mkdir -p /var/run /var/log
  touch /var/run/utmp /var/log/wtmp /var/log/btmp /var/log/lastlog 2>/dev/null || true
  chmod 664 /var/run/utmp /var/log/wtmp /var/log/btmp /var/log/lastlog 2>/dev/null || true

  cat >/etc/issue <<ISSUE
${distro}
${hostname} login: 
ISSUE

  if [ -d /etc/pam.d ]; then
    cat >/etc/pam.d/login <<'PAMLOGIN'
#%PAM-1.0
auth       required   pam_unix.so
account    required   pam_unix.so
password   required   pam_unix.so
session    optional   pam_unix.so
session    optional   pam_motd.so
PAMLOGIN
  fi

  if [ -f /etc/pam.d/su ]; then
    cat >/etc/pam.d/su <<'PAMSU'
#%PAM-1.0
auth       sufficient pam_rootok.so
auth       required   pam_unix.so
account    required   pam_unix.so
session    optional   pam_unix.so
PAMSU
  fi

  return 0
}

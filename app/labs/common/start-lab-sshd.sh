#!/bin/bash
# Prepare and run OpenSSH in the foreground for lab-target containers.
set -euo pipefail

remove_privilege_separation_directives() {
  sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' /etc/ssh/sshd_config 2>/dev/null || true
  if [ -d /etc/ssh/sshd_config.d ]; then
    find /etc/ssh/sshd_config.d -type f -name '*.conf' \
      -exec sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' {} \; 2>/dev/null || true
  fi
}

prepare_sshd_runtime() {
  mkdir -p /run/sshd /var/run /var/log
  chown root:root /run/sshd 2>/dev/null || true
  chmod 0755 /run/sshd 2>/dev/null || true
  prepare_login_accounting

  if ! command -v ssh-keygen >/dev/null 2>&1; then
    echo "prepare_sshd_runtime: ssh-keygen not found (install openssh-server)" >&2
    return 1
  fi

  ssh-keygen -A >/dev/null 2>&1 || ssh-keygen -A

  if ! ls /etc/ssh/ssh_host_*_key >/dev/null 2>&1; then
    echo "prepare_sshd_runtime: host keys still missing after ssh-keygen -A" >&2
    return 1
  fi
}

prepare_login_accounting() {
  mkdir -p /var/run /var/log
  : >/var/run/utmp 2>/dev/null || touch /var/run/utmp
  touch /var/log/wtmp /var/log/btmp /var/log/lastlog 2>/dev/null || true
  chmod 664 /var/run/utmp /var/log/wtmp /var/log/btmp 2>/dev/null || true
  chmod 644 /var/log/lastlog 2>/dev/null || true
  if getent group utmp >/dev/null 2>&1; then
    chgrp utmp /var/run/utmp /var/log/wtmp /var/log/btmp 2>/dev/null || true
  fi
  if [ -w /proc/sys/kernel/audit ]; then
    echo 0 >/proc/sys/kernel/audit 2>/dev/null || true
  fi
}

validate_sshd_startup() {
  local u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"

  if ! command -v sshd >/dev/null 2>&1; then
    echo "validate_sshd_startup: /usr/sbin/sshd not installed" >&2
    return 1
  fi

  if [ -n "$u" ]; then
    if ! id "$u" >/dev/null 2>&1; then
      echo "validate_sshd_startup: user $u does not exist" >&2
      return 1
    fi
    getent passwd "$u" || true
    local home_dir
    home_dir="$(getent passwd "$u" | cut -d: -f6 || true)"
    if [ -n "${home_dir:-}" ]; then
      ls -ld "$home_dir" 2>/dev/null || true
    fi
  fi

  remove_privilege_separation_directives

  if ! sshd -t 2>/tmp/sshd-test.err; then
    echo "validate_sshd_startup: sshd -t failed:" >&2
    cat /tmp/sshd-test.err >&2 2>/dev/null || true
    return 1
  fi

  echo "[sshd-validate] sshd_config OK"
  return 0
}

log_sshd_listeners() {
  if command -v ss >/dev/null 2>&1; then
    ss -lntp 2>/dev/null | grep -E ':22\b' || true
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tlnp 2>/dev/null | grep -E ':22\b' || true
  fi
  ps aux 2>/dev/null | grep '[s]shd' || true
}

start_lab_sshd() {
  prepare_sshd_runtime
  remove_privilege_separation_directives
  validate_sshd_startup
  log_sshd_listeners
  echo "[sshd-validate] launching /usr/sbin/sshd -D -e"
  exec /usr/sbin/sshd -D -e
}

#!/bin/bash
# Runtime mission credentials — SGQ_* (preferred) or LAB_* (legacy).
set -euo pipefail

apply_lab_credentials() {
  local u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"
  local p="${SGQ_PASSWORD:-${LAB_PASSWORD:-}}"

  if [ -z "$u" ] || [ -z "$p" ]; then
    echo "apply_lab_credentials: SGQ_USERNAME and SGQ_PASSWORD (or LAB_*) must be set" >&2
    return 1
  fi

  if ! id "$u" >/dev/null 2>&1; then
    if ! useradd -m -s /bin/bash "$u" 2>/dev/null; then
      if command -v useradd >/dev/null 2>&1; then
        useradd -m -s /bin/sh "$u" 2>/dev/null || true
      elif command -v adduser >/dev/null 2>&1; then
        adduser -D -s /bin/sh "$u" 2>/dev/null || true
      fi
    fi
  fi

  if ! id "$u" >/dev/null 2>&1; then
    echo "apply_lab_credentials: could not create user $u" >&2
    return 1
  fi

  if ! printf '%s:%s\n' "$u" "$p" | chpasswd; then
    echo "apply_lab_credentials: chpasswd failed for $u" >&2
    return 1
  fi

  if command -v passwd >/dev/null 2>&1; then
    passwd -u "$u" 2>/dev/null || true
  fi

  local home_dir
  home_dir="$(getent passwd "$u" | cut -d: -f6 || true)"
  [ -n "${home_dir:-}" ] || home_dir="/home/$u"
  mkdir -p "$home_dir"
  chown -R "$u:$u" "$home_dir" 2>/dev/null || true

  local shell_path
  shell_path="$(getent passwd "$u" | cut -d: -f7 || true)"
  case "$shell_path" in
    ''|/usr/sbin/nologin|/bin/false|/sbin/nologin)
      usermod -s /bin/bash "$u" 2>/dev/null || usermod -s /bin/sh "$u" 2>/dev/null || true
      ;;
  esac

  return 0
}

configure_mission_sshd() {
  local u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"
  [ -f /etc/ssh/sshd_config ] || return 0

  mkdir -p /etc/ssh/sshd_config.d
  cat > /etc/ssh/sshd_config.d/99-sysadmin-game-lab.conf <<'SSHDROP'
# SysAdmin Game lab session SSH (overrides cloud image defaults)
PasswordAuthentication yes
PermitEmptyPasswords no
UsePAM no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitTTY yes
PermitUserEnvironment yes
PermitRootLogin no
ListenAddress 0.0.0.0
Port 22
SSHDROP

  if [ -n "$u" ]; then
    echo "AllowUsers $u" >> /etc/ssh/sshd_config.d/99-sysadmin-game-lab.conf
  fi

  if command -v sshd >/dev/null 2>&1; then
    sshd -t 2>/tmp/sshd-test.err || {
      echo "configure_mission_sshd: sshd -t failed:" >&2
      cat /tmp/sshd-test.err >&2 2>/dev/null || true
      return 1
    }
  fi
}

#!/bin/bash
# SysAdmin Game — runtime credential provisioning for lab-target containers.
set -euo pipefail

check_lab_user_prerequisites() {
  local missing=0
  for cmd in useradd chpasswd getent id; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "apply_lab_credentials: missing required command: $cmd" >&2
      missing=1
    fi
  done
  if [ ! -f /etc/shadow ] && [ ! -f /etc/passwd ]; then
    echo "apply_lab_credentials: /etc/passwd or shadow unavailable" >&2
    missing=1
  fi
  return "$missing"
}

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
  if command -v ssh-keygen >/dev/null 2>&1; then
    ssh-keygen -A >/dev/null 2>&1 || ssh-keygen -A || true
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

configure_mission_pam() {
  [ -d /etc/pam.d ] || return 0
  install_ssh_login_objective_marker
  cat >/etc/pam.d/sshd <<'PAM'
# Container-safe sshd PAM for lab targets (no pam_loginuid/systemd session).
auth required pam_unix.so
account required pam_unix.so
password required pam_unix.so
session required pam_unix.so
session optional pam_exec.so setuid /usr/local/bin/sgq-mark-ssh-login.sh
PAM
}

install_ssh_login_objective_marker() {
  cat >/usr/local/bin/sgq-mark-ssh-login.sh <<'MARKER'
#!/bin/sh
# Record successful sshd session open for lab objective auto-checks.
touch /tmp/objective-ssh-login 2>/dev/null || true
exit 0
MARKER
  chmod 755 /usr/local/bin/sgq-mark-ssh-login.sh 2>/dev/null || true
}

ensure_ssh_login_marker_in_bashrc() {
  local home_dir="$1"
  local u="$2"
  local tag="# sgq-ssh-login-marker"
  [ -n "${home_dir:-}" ] || return 0
  [ -n "${u:-}" ] || return 0
  mkdir -p "$home_dir"
  if [ ! -f "$home_dir/.bashrc" ]; then
    cat >"$home_dir/.bashrc" <<'BASHRC'
# Lab target session shell
export PS1='${USER}@$(hostname -s 2>/dev/null || echo lab):\w$ '
cd "$HOME" 2>/dev/null || true
BASHRC
  fi
  if grep -q "$tag" "$home_dir/.bashrc" 2>/dev/null; then
    chown "$u:$u" "$home_dir/.bashrc" 2>/dev/null || true
    return 0
  fi
  cat >>"$home_dir/.bashrc" <<'BASHRC'

# sgq-ssh-login-marker
if [ -n "${SSH_CONNECTION:-}" ] && [ ! -f /tmp/objective-ssh-login ]; then
  touch /tmp/objective-ssh-login 2>/dev/null || true
fi
BASHRC
  chown "$u:$u" "$home_dir/.bashrc" 2>/dev/null || true
}

resolve_sftp_server_path() {
  if [ -x /usr/lib/openssh/sftp-server ]; then
    echo /usr/lib/openssh/sftp-server
  elif [ -x /usr/libexec/openssh/sftp-server ]; then
    echo /usr/libexec/openssh/sftp-server
  else
    echo /usr/lib/openssh/sftp-server
  fi
}

remove_duplicate_sftp_subsystem_lines() {
  if [ -f /etc/ssh/sshd_config ]; then
    sed -i.bak '/^[[:space:]]*Subsystem[[:space:]]\+sftp/d' /etc/ssh/sshd_config 2>/dev/null || true
  fi
  if [ -d /etc/ssh/sshd_config.d ]; then
    for f in /etc/ssh/sshd_config.d/*.conf; do
      [ -f "$f" ] || continue
      sed -i.bak '/^[[:space:]]*Subsystem[[:space:]]\+sftp/d' "$f" 2>/dev/null || true
    done
  fi
}

neutralize_main_sshd_overrides() {
  [ -f /etc/ssh/sshd_config ] || return 0
  sed -i.bak \
    -e 's/^UsePAM no[[:space:]]*$/UsePAM yes/' \
    -e 's/^PasswordAuthentication no[[:space:]]*$/PasswordAuthentication yes/' \
    /etc/ssh/sshd_config 2>/dev/null || true
  remove_privilege_separation_directives
}

subsystem_sftp_configured() {
  grep -rq '^[[:space:]]*Subsystem[[:space:]]\+sftp' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null
}

ensure_lab_user_unlocked() {
  local u="$1"
  passwd -u "$u" 2>/dev/null || true
  if command -v usermod >/dev/null 2>&1; then
    usermod -U "$u" 2>/dev/null || true
  fi
  if command -v passwd >/dev/null 2>&1; then
    local status
    status="$(passwd -S "$u" 2>/dev/null | awk '{print $2}' || true)"
    case "$status" in
      L|LK)
        usermod -U "$u" 2>/dev/null || true
        passwd -u "$u" 2>/dev/null || true
        ;;
    esac
  fi
}

install_lab_session_helpers() {
  if [ -f /usr/local/bin/mark-lab-complete ]; then
    chmod 755 /usr/local/bin/mark-lab-complete 2>/dev/null || true
    return 0
  fi
  cat >/usr/local/bin/mark-lab-complete <<'MARKER'
#!/bin/sh
touch /tmp/lab-complete 2>/dev/null || true
if [ -f /tmp/lab-complete ]; then
  echo "Training marker created at /tmp/lab-complete"
  echo "Return to the app and click Validate / Check to finish the lab."
  exit 0
fi
echo "Could not create /tmp/lab-complete" >&2
echo "Make sure you ran this on the training server (after SSH), not on your workstation." >&2
exit 1
MARKER
  chmod 755 /usr/local/bin/mark-lab-complete 2>/dev/null || true
}

install_ssh_completion_hint() {
  local home_dir="$1"
  local u="$2"
  local tag="# sgq-completion-hint"
  [ -n "${LAB_COMPLETION_HINT:-}" ] || return 0
  [ -n "${home_dir:-}" ] || return 0
  [ -n "${u:-}" ] || return 0
  if grep -q "$tag" "$home_dir/.bashrc" 2>/dev/null; then
    return 0
  fi
  cat >>"$home_dir/.bashrc" <<BASHRC

$tag
if [ -n "\${SSH_CONNECTION:-}" ] && [ -z "\${SGQ_COMPLETION_HINT_SHOWN:-}" ]; then
  export SGQ_COMPLETION_HINT_SHOWN=1
  echo "${LAB_COMPLETION_HINT}"
fi
BASHRC
  chown "$u:$u" "$home_dir/.bashrc" 2>/dev/null || true
}

configure_lab_user_sudo() {
  local u="$1"
  [ -n "$u" ] || return 0
  [ "$u" = "root" ] && return 0
  command -v sudo >/dev/null 2>&1 || return 0

  if getent group sudo >/dev/null 2>&1; then
    usermod -aG sudo "$u" 2>/dev/null || true
  elif getent group wheel >/dev/null 2>&1; then
    usermod -aG wheel "$u" 2>/dev/null || true
  fi

  [ -d /etc/sudoers.d ] || return 0
  local dropin="/etc/sudoers.d/99-sgq-lab-session"
  printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$u" >"$dropin"
  chmod 440 "$dropin"
  if command -v visudo >/dev/null 2>&1; then
    if ! visudo -cf "$dropin" >/dev/null 2>&1; then
      rm -f "$dropin"
      echo "apply_lab_credentials: invalid sudoers drop-in for $u" >&2
      return 1
    fi
  fi
  return 0
}

configure_lab_user_shell() {
  local u="$1"
  local home_dir
  home_dir="$(getent passwd "$u" | cut -d: -f6 || true)"
  [ -n "${home_dir:-}" ] || home_dir="/home/$u"
  mkdir -p "$home_dir"
  chown -R "$u:$u" "$home_dir"

  local shell_path
  shell_path="$(getent passwd "$u" | cut -d: -f7 || true)"
  case "$shell_path" in
    ''|/usr/sbin/nologin|/bin/false|/sbin/nologin)
      usermod -s /bin/bash "$u" 2>/dev/null || usermod -s /bin/sh "$u" 2>/dev/null || true
      ;;
  esac

  if [ ! -f "$home_dir/.bashrc" ]; then
    cat >"$home_dir/.bashrc" <<'BASHRC'
# Lab target session shell
export PS1='${USER}@$(hostname -s 2>/dev/null || echo lab):\w$ '
cd "$HOME" 2>/dev/null || true
BASHRC
    chown "$u:$u" "$home_dir/.bashrc"
  fi

  ensure_ssh_login_marker_in_bashrc "$home_dir" "$u"
  install_lab_session_helpers
  install_ssh_completion_hint "$home_dir" "$u"

  if [ ! -f "$home_dir/.profile" ]; then
    cat >"$home_dir/.profile" <<'PROFILE'
[ -f "${HOME}/.bashrc" ] && . "${HOME}/.bashrc"
PROFILE
    chown "$u:$u" "$home_dir/.profile"
  fi
}

reload_mission_sshd() {
  if [ ! -d /run/sshd ]; then
    mkdir -p /run/sshd
    chmod 0755 /run/sshd 2>/dev/null || true
  fi
  if [ -f /run/sshd.pid ] && kill -HUP "$(cat /run/sshd.pid)" 2>/dev/null; then
    return 0
  fi
  if command -v pgrep >/dev/null 2>&1 && pgrep sshd >/dev/null 2>&1; then
    pkill -HUP sshd 2>/dev/null || true
  fi
  return 0
}

apply_lab_credentials() {
  local u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"
  local p="${SGQ_PASSWORD:-${LAB_PASSWORD:-}}"

  if [ -z "$u" ] || [ -z "$p" ]; then
    echo "apply_lab_credentials: SGQ_USERNAME and SGQ_PASSWORD are required" >&2
    if [ -z "${SGQ_USERNAME:-}${LAB_USERNAME:-}" ]; then
      echo "apply_lab_credentials: SGQ_USERNAME/LAB_USERNAME is not set in container env" >&2
    fi
    if [ -z "${SGQ_PASSWORD:-}${LAB_PASSWORD:-}" ]; then
      echo "apply_lab_credentials: SGQ_PASSWORD/LAB_PASSWORD is not set in container env" >&2
    fi
    return 1
  fi

  if ! check_lab_user_prerequisites; then
    return 1
  fi

  if [ "$u" = "root" ]; then
    if ! printf '%s:%s\n' "root" "$p" | chpasswd 2>/tmp/chpasswd.err; then
      cat /tmp/chpasswd.err >&2 2>/dev/null || true
      echo "apply_lab_credentials: chpasswd failed for root" >&2
      return 1
    fi
    ensure_lab_user_unlocked root
    echo "apply_lab_credentials: root password configured"
    return 0
  fi

  if ! id "$u" >/dev/null 2>&1; then
    if ! useradd -m -s /bin/bash "$u" 2>/tmp/useradd.err; then
      cat /tmp/useradd.err >&2 2>/dev/null || true
      if ! useradd -m -s /bin/sh "$u" 2>/tmp/useradd.err; then
        cat /tmp/useradd.err >&2 2>/dev/null || true
        echo "apply_lab_credentials: useradd failed for $u" >&2
        return 1
      fi
    fi
  fi

  if ! id "$u" >/dev/null 2>&1; then
    echo "apply_lab_credentials: could not create user $u" >&2
    return 1
  fi

  if ! printf '%s:%s\n' "$u" "$p" | chpasswd 2>/tmp/chpasswd.err; then
    cat /tmp/chpasswd.err >&2 2>/dev/null || true
    echo "apply_lab_credentials: chpasswd failed for $u" >&2
    return 1
  fi

  ensure_lab_user_unlocked "$u"

  configure_lab_user_shell "$u"
  configure_lab_user_sudo "$u" || true

  local home_dir
  home_dir="$(getent passwd "$u" | cut -d: -f6 || true)"
  [ -n "${home_dir:-}" ] || home_dir="/home/$u"
  mkdir -p "$home_dir"
  chown -R "$u:$u" "$home_dir"

  local shell_path
  shell_path="$(getent passwd "$u" | cut -d: -f7 || true)"
  case "$shell_path" in
    ''|/usr/sbin/nologin|/bin/false|/sbin/nologin)
      usermod -s /bin/bash "$u" 2>/dev/null || usermod -s /bin/sh "$u" 2>/dev/null || true
      ;;
  esac

  if ! id "$u" >/dev/null 2>&1; then
    echo "apply_lab_credentials: post-create id check failed for $u" >&2
    return 1
  fi

  echo "apply_lab_credentials: user $u ready ($(id "$u"))"
  ls -ld "$home_dir" 2>/dev/null || true
  getent passwd "$u" || true
}

configure_mission_sshd() {
  local u="${SGQ_USERNAME:-${LAB_USERNAME:-}}"
  local dropin="/etc/ssh/sshd_config.d/99-sgq.conf"
  local sftp_bin
  sftp_bin="$(resolve_sftp_server_path)"

  [ -f /etc/ssh/sshd_config ] || {
    echo "configure_mission_sshd: /etc/ssh/sshd_config not found (openssh-server missing?)" >&2
    return 1
  }

  prepare_sshd_runtime
  mkdir -p /etc/ssh/sshd_config.d
  configure_mission_pam

  rm -f /etc/ssh/sshd_config.d/99-sysadmin-game-lab.conf 2>/dev/null || true
  remove_duplicate_sftp_subsystem_lines
  neutralize_main_sshd_overrides
  remove_privilege_separation_directives

  if [ "$u" = "root" ]; then
    cat > "$dropin" <<SSHDROP
Port 22
ListenAddress 0.0.0.0
PasswordAuthentication yes
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
UsePAM yes
PermitRootLogin yes
PermitTTY yes
PermitUserEnvironment yes
PrintLastLog no
PrintMotd no
StrictModes no
X11Forwarding no
LoginGraceTime 120
MaxSessions 10
SSHDROP
  else
    cat > "$dropin" <<SSHDROP
Port 22
ListenAddress 0.0.0.0
PasswordAuthentication yes
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
UsePAM yes
PermitRootLogin no
AllowUsers $u
PermitTTY yes
PermitUserEnvironment yes
PrintLastLog no
PrintMotd no
StrictModes no
X11Forwarding no
LoginGraceTime 120
MaxSessions 10
SSHDROP
  fi

  if ! subsystem_sftp_configured; then
    echo "Subsystem sftp ${sftp_bin}" >> "$dropin"
  fi

  remove_privilege_separation_directives

  if ! sshd -t 2>/tmp/sshd-test.err; then
    echo "configure_mission_sshd: sshd -t failed:" >&2
    cat /tmp/sshd-test.err >&2 2>/dev/null || true
    return 1
  fi

  echo "configure_mission_sshd: sshd config OK"
  reload_mission_sshd
}

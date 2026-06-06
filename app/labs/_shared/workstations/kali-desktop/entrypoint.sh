#!/bin/bash
# Kali desktop workstation — XFCE via TigerVNC + noVNC on port 3000.
set -euo pipefail

USERNAME="${SGQ_USERNAME:-${LAB_USERNAME:-user}}"
HOSTNAME="${LAB_HOSTNAME:-kali-desktop}"
HOME_DIR="/home/${USERNAME}"
TARGET_IP="${SGQ_TARGET_INTERNAL_IP:-}"
WORKSTATION_LABEL="${SGQ_WORKSTATION_LABEL:-Kali Desktop Workstation}"
WORKSTATION_DISTRO="${SGQ_WORKSTATION_DISTRO:-Kali Linux}"
DEFAULT_SHELL="${SGQ_WORKSTATION_SHELL:-/bin/bash}"
VNC_DISPLAY=":1"
VNC_PORT="5901"

hostname "${HOSTNAME}" 2>/dev/null || true

if ! id "$USERNAME" >/dev/null 2>&1; then
  useradd -m -s "$DEFAULT_SHELL" -d "$HOME_DIR" "$USERNAME"
fi

if [ -f /usr/local/bin/configure-workstation-login.sh ]; then
  # shellcheck source=/dev/null
  . /usr/local/bin/configure-workstation-login.sh
  configure_workstation_login \
    "$USERNAME" \
    "${SGQ_PASSWORD:-${LAB_PASSWORD:-}}" \
    "$HOSTNAME" \
    "$WORKSTATION_DISTRO" \
    "$HOME_DIR" \
    "$DEFAULT_SHELL"
fi

mkdir -p "$HOME_DIR"
chown "${USERNAME}:${USERNAME}" "$HOME_DIR"

if [ ! -f /etc/sudoers.d/lab-workstation ]; then
  echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" >/etc/sudoers.d/lab-workstation
  chmod 440 /etc/sudoers.d/lab-workstation
fi

mkdir -p "${HOME_DIR}/.ssh"
chmod 700 "${HOME_DIR}/.ssh"
cat >"${HOME_DIR}/.ssh/config" <<CFG
Host lab-target
  HostName lab-target
  User ${USERNAME}
  PreferredAuthentications password
  PubkeyAuthentication no
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
CFG
if [ -n "$TARGET_IP" ]; then
  cat >>"${HOME_DIR}/.ssh/config" <<CFG

Host lab-target-ip
  HostName ${TARGET_IP}
  User ${USERNAME}
  PreferredAuthentications password
  PubkeyAuthentication no
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
CFG
fi
chmod 600 "${HOME_DIR}/.ssh/config"
chown -R "${USERNAME}:${USERNAME}" "${HOME_DIR}/.ssh"

mkdir -p "${HOME_DIR}/.vnc"
cat >"${HOME_DIR}/.vnc/xstartup" <<'XSTART'
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
exec startxfce4
XSTART
chmod +x "${HOME_DIR}/.vnc/xstartup"
chown -R "${USERNAME}:${USERNAME}" "${HOME_DIR}/.vnc"

su - "$USERNAME" -c "vncserver -kill ${VNC_DISPLAY}" 2>/dev/null || true
su - "$USERNAME" -c "vncserver ${VNC_DISPLAY} -geometry 1280x720 -depth 24 -localhost no -SecurityTypes None" || {
  echo "kali-desktop: vncserver failed to start" >&2
  exit 1
}

if command -v websockify >/dev/null 2>&1; then
  websockify --web /usr/share/novnc/ 3000 "localhost:${VNC_PORT}" &
elif command -v novnc_proxy >/dev/null 2>&1; then
  novnc_proxy --vnc "localhost:${VNC_PORT}" --listen 3000 &
else
  echo "kali-desktop: novnc/websockify not found" >&2
  exit 1
fi

echo "kali-desktop: noVNC listening on :3000 (base image kalilinux/kali-rolling)" >&2

exec tail -f /dev/null

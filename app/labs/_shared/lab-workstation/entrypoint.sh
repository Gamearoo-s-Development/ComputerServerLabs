#!/bin/bash
# Lab workstation — real Ubuntu admin jump box for the integrated Lab Terminal.
set -euo pipefail

USERNAME="${SGQ_USERNAME:-${LAB_USERNAME:-user}}"
HOSTNAME="${LAB_HOSTNAME:-lab-workstation}"
HOME_DIR="/home/${USERNAME}"
TARGET_IP="${SGQ_TARGET_INTERNAL_IP:-}"

hostname "${HOSTNAME}" 2>/dev/null || true

if ! id "$USERNAME" >/dev/null 2>&1; then
  useradd -m -s /bin/bash -d "$HOME_DIR" "$USERNAME"
fi

mkdir -p "$HOME_DIR"
chown "${USERNAME}:${USERNAME}" "$HOME_DIR"

if [ ! -f /etc/sudoers.d/lab-workstation ]; then
  echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" >/etc/sudoers.d/lab-workstation
  chmod 440 /etc/sudoers.d/lab-workstation
fi

cat >/etc/motd <<'MOTD'
SysAdmin Game — Lab Workstation
This is an isolated Linux workstation. Use it like a real admin box.
Connect to the lab target with SSH when you are ready (see the lab session panel).
MOTD

# shellcheck disable=SC2016
cat >"${HOME_DIR}/.bashrc" <<EOF
# Lab workstation shell
export PS1='${USERNAME}@lab-workstation:\w\$ '
export HOME='${HOME_DIR}'
if [ -f /etc/motd ] && [ -z "\${SGQ_MOTD_SHOWN:-}" ]; then
  export SGQ_MOTD_SHOWN=1
  cat /etc/motd
fi
cd "\${HOME}" 2>/dev/null || true
EOF

cat >"${HOME_DIR}/.profile" <<'PROFILE'
[ -f "${HOME}/.bashrc" ] && . "${HOME}/.bashrc"
PROFILE

chown "${USERNAME}:${USERNAME}" "${HOME_DIR}/.bashrc" "${HOME_DIR}/.profile"

if [ -n "$TARGET_IP" ]; then
  mkdir -p "${HOME_DIR}/.ssh"
  chmod 700 "${HOME_DIR}/.ssh"
  cat >"${HOME_DIR}/.ssh/config" <<CFG
Host lab-target
  HostName ${TARGET_IP}
  User ${USERNAME}
  PreferredAuthentications password
  PubkeyAuthentication no
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
CFG
  chmod 600 "${HOME_DIR}/.ssh/config"
  chown -R "${USERNAME}:${USERNAME}" "${HOME_DIR}/.ssh"
fi

cat >/usr/local/bin/connect-lab <<'CONNECT'
#!/bin/bash
set -euo pipefail
u="${SGQ_USERNAME:-${LAB_USERNAME:-user}}"
ip="${SGQ_TARGET_INTERNAL_IP:-}"
if [ -n "$ip" ]; then
  exec ssh "${u}@${ip}"
fi
if [ -f "${HOME}/.ssh/config" ] && grep -q '^Host lab-target' "${HOME}/.ssh/config" 2>/dev/null; then
  exec ssh lab-target
fi
echo "Lab target is not configured yet. Use: ssh USER@<lab-target-ip>" >&2
exit 1
CONNECT
chmod 755 /usr/local/bin/connect-lab

exec tail -f /dev/null

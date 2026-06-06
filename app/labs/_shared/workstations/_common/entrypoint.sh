#!/bin/bash
# Shared lab workstation entrypoint — isolated jump box for the Lab Terminal.
set -euo pipefail

USERNAME="${SGQ_USERNAME:-${LAB_USERNAME:-user}}"
HOSTNAME="${LAB_HOSTNAME:-lab-workstation}"
HOME_DIR="/home/${USERNAME}"
TARGET_IP="${SGQ_TARGET_INTERNAL_IP:-}"
WORKSTATION_LABEL="${SGQ_WORKSTATION_LABEL:-Lab Workstation}"
WORKSTATION_DISTRO="${SGQ_WORKSTATION_DISTRO:-Linux}"
DEFAULT_SHELL="${SGQ_WORKSTATION_SHELL:-/bin/bash}"

hostname "${HOSTNAME}" 2>/dev/null || true

if ! id "$USERNAME" >/dev/null 2>&1; then
  useradd -m -s "$DEFAULT_SHELL" -d "$HOME_DIR" "$USERNAME"
fi

mkdir -p "$HOME_DIR"
chown "${USERNAME}:${USERNAME}" "$HOME_DIR"

if [ ! -f /etc/sudoers.d/lab-workstation ]; then
  echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" >/etc/sudoers.d/lab-workstation
  chmod 440 /etc/sudoers.d/lab-workstation
fi

cat >/etc/motd <<MOTD
SysAdmin Game — ${WORKSTATION_LABEL}
${WORKSTATION_DISTRO} admin jump box on an isolated Docker network.
Connect to the lab target with SSH when you are ready (see the lab session panel).
MOTD

# shellcheck disable=SC2016
cat >"${HOME_DIR}/.bashrc" <<EOF
# Lab workstation shell
export PS1='${USERNAME}@${HOSTNAME}:\w\$ '
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

cat >/usr/local/bin/connect-lab <<'CONNECT'
#!/bin/bash
set -euo pipefail
u="${SGQ_USERNAME:-${LAB_USERNAME:-user}}"
if [ -f "${HOME}/.ssh/config" ] && grep -q '^Host lab-target' "${HOME}/.ssh/config" 2>/dev/null; then
  exec ssh lab-target
fi
ip="${SGQ_TARGET_INTERNAL_IP:-}"
if [ -n "$ip" ]; then
  exec ssh "${u}@${ip}"
fi
echo "Lab target is not configured yet. Use: ssh USER@lab-target" >&2
exit 1
CONNECT
chmod 755 /usr/local/bin/connect-lab

exec tail -f /dev/null

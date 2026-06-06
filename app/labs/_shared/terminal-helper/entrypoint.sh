#!/bin/sh

# Sandbox terminal-helper — isolated lab workstation (SSH client only; not the training target).

# Keep LF line endings (CRLF breaks the shebang on Linux).

USERNAME="${SGQ_USERNAME:-${LAB_USERNAME:-user}}"
HOSTNAME="${LAB_HOSTNAME:-lab-workstation}"
HOME_DIR="/home/${USERNAME}"
TARGET_IP="${SGQ_TARGET_INTERNAL_IP:-}"

hostname "${HOSTNAME}" 2>/dev/null || true

if ! id "$USERNAME" >/dev/null 2>&1; then
  if ! adduser -D -s /bin/bash -h "$HOME_DIR" "$USERNAME" 2>/dev/null; then
    adduser -D -s /bin/sh -h "$HOME_DIR" "$USERNAME" 2>/dev/null || true
  fi
fi

mkdir -p "$HOME_DIR" 2>/dev/null || true
chown "${USERNAME}:${USERNAME}" "$HOME_DIR" 2>/dev/null || true

# shellcheck disable=SC2016
cat > "${HOME_DIR}/.bashrc" <<EOF
export PS1='${USERNAME}@lab-workstation:\w\$ '
export HOME='${HOME_DIR}'
cd "\${HOME}" 2>/dev/null || true
EOF

cat > "${HOME_DIR}/.profile" <<EOF
[ -f "\${HOME}/.bashrc" ] && . "\${HOME}/.bashrc"
EOF

chown "${USERNAME}:${USERNAME}" "${HOME_DIR}/.bashrc" "${HOME_DIR}/.profile" 2>/dev/null || true

if [ -n "$TARGET_IP" ]; then
  mkdir -p "${HOME_DIR}/.ssh"
  chmod 700 "${HOME_DIR}/.ssh"
  cat > "${HOME_DIR}/.ssh/config" <<CFG
Host lab-target
  HostName ${TARGET_IP}
  User ${USERNAME}
  PreferredAuthentications password
  PubkeyAuthentication no
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
CFG
  chmod 600 "${HOME_DIR}/.ssh/config"
  chown -R "${USERNAME}:${USERNAME}" "${HOME_DIR}/.ssh" 2>/dev/null || true
fi

cat > /usr/local/bin/connect-lab <<'EOF'
#!/bin/sh
if [ -n "${SGQ_TARGET_INTERNAL_IP:-}" ]; then
  exec ssh "${SGQ_USERNAME:-${LAB_USERNAME:-user}}@${SGQ_TARGET_INTERNAL_IP}"
fi
if [ -f "${HOME}/.ssh/config" ] && grep -q '^Host lab-target' "${HOME}/.ssh/config" 2>/dev/null; then
  exec ssh lab-target
fi
echo "Lab target IP is not configured yet. Use: ssh USER@<lab-target-ip>" >&2
exit 1
EOF
chmod 755 /usr/local/bin/connect-lab 2>/dev/null || true

exec tail -f /dev/null

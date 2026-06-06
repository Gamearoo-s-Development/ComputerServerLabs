/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @type {Record<string, { label: string, dockerfile: string, entrypoint: string, validateSh: string }>} */
export const DOCKER_TEMPLATES = {
  'ubuntu-ssh': {
    label: 'Ubuntu SSH lab',
    dockerfile: `FROM ubuntu:22.04
RUN apt-get update && apt-get install -y openssh-server && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 22
CMD ["/entrypoint.sh"]
`,
    entrypoint: `#!/bin/bash
set -euo pipefail
apply_lab_credentials() {
  if [ -z "\${LAB_USERNAME:-}" ] || [ -z "\${LAB_PASSWORD:-}" ]; then
    return 0
  fi
  if ! id "$LAB_USERNAME" >/dev/null 2>&1; then
    useradd -m -s /bin/bash "$LAB_USERNAME" 2>/dev/null || true
  fi
  echo "\${LAB_USERNAME}:\${LAB_PASSWORD}" | chpasswd
}
mkdir -p /run/sshd
chown root:root /run/sshd 2>/dev/null || true
chmod 0755 /run/sshd 2>/dev/null || true
sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' /etc/ssh/sshd_config 2>/dev/null || true
find /etc/ssh/sshd_config.d -type f -name '*.conf' -exec sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' {} \; 2>/dev/null || true
ssh-keygen -A >/dev/null 2>&1 || true
apply_lab_credentials
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config || true
echo "UsePAM no" >> /etc/ssh/sshd_config
echo "PermitRootLogin no" >> /etc/ssh/sshd_config
/usr/sbin/sshd -t || exit 1
exec /usr/sbin/sshd -D -e -u0
`,
    validateSh: `#!/bin/bash
# Optional — run inside container only
set -e
echo "ok"
`
  },
  nginx: {
    label: 'NGINX repair lab',
    dockerfile: `FROM ubuntu:22.04
RUN apt-get update && apt-get install -y nginx openssh-server curl && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 22 80
CMD ["/entrypoint.sh"]
`,
    entrypoint: `#!/bin/bash
set -euo pipefail
apply_lab_credentials() {
  if [ -z "\${LAB_USERNAME:-}" ] || [ -z "\${LAB_PASSWORD:-}" ]; then return 0; fi
  if ! id "$LAB_USERNAME" >/dev/null 2>&1; then useradd -m -s /bin/bash "$LAB_USERNAME" 2>/dev/null || true; fi
  echo "\${LAB_USERNAME}:\${LAB_PASSWORD}" | chpasswd
}
mkdir -p /run/sshd
chown root:root /run/sshd 2>/dev/null || true
chmod 0755 /run/sshd 2>/dev/null || true
sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' /etc/ssh/sshd_config 2>/dev/null || true
find /etc/ssh/sshd_config.d -type f -name '*.conf' -exec sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' {} \; 2>/dev/null || true
ssh-keygen -A >/dev/null 2>&1 || true
apply_lab_credentials
echo "server { listen 80; }" > /etc/nginx/sites-enabled/default || true
/usr/sbin/sshd -t || exit 1
exec /usr/sbin/sshd -D -e -u0 &
exec nginx -g "daemon off;"
`,
    validateSh: `#!/bin/bash
curl -sf -o /dev/null http://127.0.0.1/ || exit 1
`
  },
  permissions: {
    label: 'Permissions repair lab',
    dockerfile: `FROM ubuntu:22.04
RUN apt-get update && apt-get install -y openssh-server && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
RUN mkdir -p /var/www/config && echo "training" > /var/www/config/app.conf && chmod 000 /var/www/config/app.conf
EXPOSE 22
CMD ["/entrypoint.sh"]
`,
    entrypoint: `#!/bin/bash
set -euo pipefail
apply_lab_credentials() {
  if [ -z "\${LAB_USERNAME:-}" ] || [ -z "\${LAB_PASSWORD:-}" ]; then return 0; fi
  if ! id "$LAB_USERNAME" >/dev/null 2>&1; then useradd -m -s /bin/bash "$LAB_USERNAME" 2>/dev/null || true; fi
  echo "\${LAB_USERNAME}:\${LAB_PASSWORD}" | chpasswd
}
mkdir -p /run/sshd
chown root:root /run/sshd 2>/dev/null || true
chmod 0755 /run/sshd 2>/dev/null || true
sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' /etc/ssh/sshd_config 2>/dev/null || true
find /etc/ssh/sshd_config.d -type f -name '*.conf' -exec sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' {} \; 2>/dev/null || true
ssh-keygen -A >/dev/null 2>&1 || true
apply_lab_credentials
chown student:student /var/www/config/app.conf 2>/dev/null || true
/usr/sbin/sshd -t || exit 1
exec /usr/sbin/sshd -D -e -u0
`,
    validateSh: `#!/bin/bash
test -f /var/www/config/app.conf || exit 1
`
  },
  'disk-cleanup': {
    label: 'Disk cleanup lab',
    dockerfile: `FROM ubuntu:22.04
RUN apt-get update && apt-get install -y openssh-server && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 22
CMD ["/entrypoint.sh"]
`,
    entrypoint: `#!/bin/bash
set -euo pipefail
apply_lab_credentials() {
  if [ -z "\${LAB_USERNAME:-}" ] || [ -z "\${LAB_PASSWORD:-}" ]; then return 0; fi
  if ! id "$LAB_USERNAME" >/dev/null 2>&1; then useradd -m -s /bin/bash "$LAB_USERNAME" 2>/dev/null || true; fi
  echo "\${LAB_USERNAME}:\${LAB_PASSWORD}" | chpasswd
}
mkdir -p /run/sshd
chown root:root /run/sshd 2>/dev/null || true
chmod 0755 /run/sshd 2>/dev/null || true
sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' /etc/ssh/sshd_config 2>/dev/null || true
find /etc/ssh/sshd_config.d -type f -name '*.conf' -exec sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' {} \; 2>/dev/null || true
ssh-keygen -A >/dev/null 2>&1 || true
mkdir -p /opt/lab && echo '#!/bin/bash
exit 0' > /opt/lab/verify-cleanup && chmod +x /opt/lab/verify-cleanup
apply_lab_credentials
/usr/sbin/sshd -t || exit 1
exec /usr/sbin/sshd -D -e -u0
`,
    validateSh: `#!/bin/bash
/opt/lab/verify-cleanup
`
  },
  'service-repair': {
    label: 'Service repair lab',
    dockerfile: `FROM ubuntu:22.04
RUN apt-get update && apt-get install -y openssh-server systemd systemd-sysv curl && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 22
CMD ["/entrypoint.sh"]
`,
    entrypoint: `#!/bin/bash
set -euo pipefail
apply_lab_credentials() {
  if [ -z "\${LAB_USERNAME:-}" ] || [ -z "\${LAB_PASSWORD:-}" ]; then return 0; fi
  if ! id "$LAB_USERNAME" >/dev/null 2>&1; then useradd -m -s /bin/bash "$LAB_USERNAME" 2>/dev/null || true; fi
  echo "\${LAB_USERNAME}:\${LAB_PASSWORD}" | chpasswd
}
mkdir -p /run/sshd
chown root:root /run/sshd 2>/dev/null || true
chmod 0755 /run/sshd 2>/dev/null || true
sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' /etc/ssh/sshd_config 2>/dev/null || true
find /etc/ssh/sshd_config.d -type f -name '*.conf' -exec sed -i '/^[[:space:]]*UsePrivilegeSeparation[[:space:]]/d' {} \; 2>/dev/null || true
ssh-keygen -A >/dev/null 2>&1 || true
apply_lab_credentials
/usr/sbin/sshd -t || exit 1
exec /usr/sbin/sshd -D -e -u0
`,
    validateSh: `#!/bin/bash
systemctl --version >/dev/null 2>&1 || true
exit 0
`
  },
  blank: {
    label: 'Blank custom Dockerfile',
    dockerfile: `FROM ubuntu:22.04
# Add packages and COPY scripts here — all work happens inside the image.
WORKDIR /workspace
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
`,
    entrypoint: `#!/bin/bash
set -euo pipefail
echo "Customize this entrypoint."
exec sleep infinity
`,
    validateSh: `#!/bin/bash
exit 0
`
  }
}

export function templateKeys() {
  return Object.keys(DOCKER_TEMPLATES)
}

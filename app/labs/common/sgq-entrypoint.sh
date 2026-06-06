#!/bin/bash
# SysAdmin Game — standard lab-target entrypoint (runtime SGQ_USERNAME / SGQ_PASSWORD).
set -euo pipefail

SGQ_USER="${SGQ_USERNAME:-${LAB_USERNAME:-}}"
SGQ_PASS="${SGQ_PASSWORD:-${LAB_PASSWORD:-}}"

if [ -z "$SGQ_USER" ] || [ -z "$SGQ_PASS" ]; then
  echo "sgq-entrypoint: SGQ_USERNAME and SGQ_PASSWORD must be set" >&2
  exit 1
fi

export SGQ_USERNAME="$SGQ_USER"
export SGQ_PASSWORD="$SGQ_PASS"
export LAB_USERNAME="$SGQ_USER"
export LAB_PASSWORD="$SGQ_PASS"

# shellcheck source=/dev/null
. /usr/local/bin/apply-lab-credentials.sh
apply_lab_credentials
configure_mission_sshd

if [ -f /usr/local/bin/apply-lab-files.sh ]; then
  if [ "$SGQ_USER" = "root" ]; then
    export SGQ_LOGIN_DIR="/root"
    export SGQ_LOGIN_USER="root"
  else
    export SGQ_LOGIN_DIR="/home/$SGQ_USER"
    export SGQ_LOGIN_USER="$SGQ_USER"
  fi
  # shellcheck source=/dev/null
  . /usr/local/bin/apply-lab-files.sh
  apply_lab_files || {
    echo "sgq-entrypoint: apply_lab_files failed — aborting startup" >&2
    exit 1
  }
fi

if [ -x /usr/local/bin/lab-setup.sh ]; then
  /usr/local/bin/lab-setup.sh
fi

# shellcheck source=/dev/null
. /usr/local/bin/start-lab-sshd.sh
start_lab_sshd

#!/bin/bash
# Container-safe workstation login prompt (avoids /bin/login TTY chown failures in Docker).
set -euo pipefail

MAX_ATTEMPTS=3
EXPECTED_USER="${SGQ_USERNAME:-${LAB_USERNAME:-}}"
EXPECTED_PASS="${SGQ_PASSWORD:-${LAB_PASSWORD:-}}"
LOGIN_SHELL="${SGQ_WORKSTATION_SHELL:-/bin/bash}"
HOST_LABEL="$(hostname -s 2>/dev/null || hostname)"

validate_credentials() {
  local user="$1"
  local pass="$2"

  if [ -z "$user" ] || [ -z "$pass" ]; then
    return 1
  fi
  if ! id "$user" >/dev/null 2>&1; then
    return 1
  fi

  if [ -n "$EXPECTED_USER" ] && [ -n "$EXPECTED_PASS" ]; then
    [ "$user" = "$EXPECTED_USER" ] && [ "$pass" = "$EXPECTED_PASS" ]
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$user" "$pass" <<'PY'
import crypt
import sys

try:
    import spwd
except ImportError:
    sys.exit(1)

username, password = sys.argv[1], sys.argv[2]
try:
    entry = spwd.getspnam(username)
    hashed = entry.sp_pwdp
except (KeyError, PermissionError):
    sys.exit(1)
if not hashed or hashed in {"!", "*", "x"}:
    sys.exit(1)
sys.exit(0 if crypt.crypt(password, hashed) == hashed else 1)
PY
    return
  fi

  return 1
}

launch_user_shell() {
  local user="$1"
  if [ -f /etc/motd ]; then
    cat /etc/motd
  fi
  # su as root inside docker exec — avoids runuser -u/-l conflicts on util-linux.
  if [ -n "$LOGIN_SHELL" ] && [ "$LOGIN_SHELL" != "$(getent passwd "$user" | cut -d: -f7)" ]; then
    exec su - "$user" -s "$LOGIN_SHELL"
  fi
  exec su - "$user"
}

if [ -f /etc/issue ]; then
  cat /etc/issue
fi

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  IFS= read -r -p "${HOST_LABEL} login: " username || exit 1
  username="${username//$'\r'/}"
  username="${username//$'\n'/}"
  IFS= read -r -s -p "Password: " password || exit 1
  echo

  if validate_credentials "$username" "$password"; then
    launch_user_shell "$username"
  fi

  echo "Login incorrect"
  attempt=$((attempt + 1))
done

echo "Maximum login attempts exceeded"
exit 1

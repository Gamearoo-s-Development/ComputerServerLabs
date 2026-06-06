#!/bin/bash
set -euo pipefail

# Pass when staging partition usage drops below threshold OR the largest log is removed.
THRESHOLD=70
USAGE="$(df -P /var/log/staging | awk 'NR==2 {print $5}' | tr -d '%')"

if [ "${USAGE:-100}" -lt "$THRESHOLD" ]; then
  exit 0
fi

if [ ! -f /var/log/staging/large.log ]; then
  exit 0
fi

exit 1

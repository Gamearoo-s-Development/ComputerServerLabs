#!/bin/bash
# Verify SSH (22/OpenSSH) and HTTP (80/tcp) are allowed in UFW before or after enable.
set -euo pipefail

blob="$(ufw show added 2>/dev/null || true)
$(ufw status verbose 2>/dev/null || ufw status 2>/dev/null || true)"

echo "$blob" | grep -qiE '(^|[[:space:]])(22/tcp|OpenSSH\b)' || exit 1
echo "$blob" | grep -qiE '(^|[[:space:]])80/tcp' || exit 1
exit 0

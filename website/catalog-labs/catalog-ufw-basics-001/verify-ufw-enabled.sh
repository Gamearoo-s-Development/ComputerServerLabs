#!/bin/bash
# Verify UFW is active and still allows SSH + HTTP.
set -euo pipefail

status="$(ufw status 2>/dev/null || true)"
echo "$status" | grep -qi 'Status:[[:space:]]*active' || exit 1

echo "$status" | grep -qiE '(^|[[:space:]])(22/tcp|OpenSSH\b)' || exit 1
echo "$status" | grep -qiE '(^|[[:space:]])80/tcp' || exit 1
exit 0

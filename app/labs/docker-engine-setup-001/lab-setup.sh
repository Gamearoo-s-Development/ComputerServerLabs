#!/bin/bash
set -euo pipefail
u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
if id "$u" &>/dev/null; then
  usermod -aG sudo "$u" 2>/dev/null || true
fi
apt-get purge -y docker.io docker-ce docker-ce-cli 2>/dev/null || true
apt-get autoremove -y 2>/dev/null || true

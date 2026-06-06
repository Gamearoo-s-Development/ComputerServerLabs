#!/bin/bash
set -euo pipefail
u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
if id "$u" &>/dev/null; then
  usermod -aG sudo "$u" 2>/dev/null || true
fi
if id apprentice &>/dev/null; then
  userdel -r apprentice 2>/dev/null || userdel apprentice 2>/dev/null || true
fi

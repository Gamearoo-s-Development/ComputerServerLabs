#!/bin/bash
set -euo pipefail
u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
crontab -u "$u" -l 2>/dev/null | grep -q '/tmp/cron-heartbeat'
test -f /tmp/cron-heartbeat

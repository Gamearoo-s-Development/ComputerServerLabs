#!/bin/bash
set -euo pipefail
u="${SGQ_USERNAME:-${LAB_USERNAME:-student}}"
test -f /var/log/operator-note.txt
grep -q "$u" /var/log/operator-note.txt

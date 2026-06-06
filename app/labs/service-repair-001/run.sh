#!/bin/bash
set -euo pipefail
exec /bin/bash -c 'while true; do date -Is >> /var/log/training-agent.log; sleep 15; done'

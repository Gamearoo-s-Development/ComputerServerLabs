#!/bin/bash
set -euo pipefail
service docker start 2>/dev/null || true
exit 0

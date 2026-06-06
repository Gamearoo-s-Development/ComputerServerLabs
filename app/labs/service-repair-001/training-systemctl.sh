#!/bin/bash
set -euo pipefail

UNIT_FILE="/etc/systemd/system/training-agent.service"
PID_FILE="/run/training-agent.pid"
STATE_DIR="/run/training-agent-lab"

mkdir -p "$STATE_DIR"

read_exec_start() {
  awk -F= '/^ExecStart=/ { sub(/^ExecStart=/, ""); print; exit }' "$UNIT_FILE"
}

is_running() {
  if [ ! -f "$PID_FILE" ]; then
    return 1
  fi
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

case "${1:-}" in
  daemon-reload)
    rm -f "$PID_FILE"
    exit 0
    ;;
  start)
    if is_running; then
      exit 0
    fi
    exec_start="$(read_exec_start)"
    if [ -z "$exec_start" ] || [ ! -f "$exec_start" ]; then
      exit 1
    fi
    if [ ! -x "$exec_start" ]; then
      chmod +x "$exec_start" 2>/dev/null || exit 1
    fi
    nohup "$exec_start" >/var/log/training-agent.out 2>&1 &
    echo $! > "$PID_FILE"
    sleep 0.2
    is_running
    ;;
  stop)
    if is_running; then
      kill "$(cat "$PID_FILE")" 2>/dev/null || true
      rm -f "$PID_FILE"
    fi
    exit 0
    ;;
  is-active)
    if is_running; then
      echo active
      exit 0
    fi
    echo inactive
    exit 3
    ;;
  status)
    if is_running; then
      echo "● training-agent.service - Training Agent (SysAdmin Game Lab)"
      echo "   Active: active (running)"
      exit 0
    fi
    echo "● training-agent.service - Training Agent (SysAdmin Game Lab)"
    echo "   Active: failed (ExecStart path invalid or service not started)"
    exit 3
    ;;
  *)
    echo "training lab systemctl: unsupported command $1" >&2
    exit 1
    ;;
esac

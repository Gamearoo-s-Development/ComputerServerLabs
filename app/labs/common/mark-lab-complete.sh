#!/bin/sh
# Creates the training completion marker on the lab target (run after SSH login).
touch /tmp/lab-complete 2>/dev/null || true
if [ -f /tmp/lab-complete ]; then
  echo "Training marker created at /tmp/lab-complete"
  echo "Return to the app and click Validate / Check to finish the lab."
  exit 0
fi
echo "Could not create /tmp/lab-complete" >&2
echo "Make sure you ran this on the training server (after SSH), not on your workstation." >&2
exit 1

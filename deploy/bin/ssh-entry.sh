#!/usr/bin/env bash
set -euo pipefail
# Used as an authorized_keys forced command. Never eval SSH_ORIGINAL_COMMAND.
if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ (frontend|backend)\ (sha256:[a-f0-9]{64})$ ]]; then
  exec sudo -n /opt/gelion/bin/deploy.sh "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
fi
echo 'Only deploy frontend|backend sha256:<digest> is allowed' >&2
exit 64

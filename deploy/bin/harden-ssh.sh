#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 && ${1:-} == --verified-admin-key-login ]] || exit 64
# Run ONLY after an independent sudo administrator has logged in using their key.
printf 'PermitRootLogin no\nPasswordAuthentication no\nKbdInteractiveAuthentication no\nPubkeyAuthentication yes\n' >/etc/ssh/sshd_config.d/00-gelion-security.conf
sshd -t
systemctl reload ssh

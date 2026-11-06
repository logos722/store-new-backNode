#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
subject=${1:-gelion-failure}
[[ $subject =~ ^[a-zA-Z0-9_.@-]+$ ]] || exit 64
to=$(cat /opt/gelion/alert-email)
printf 'To: %s\nSubject: Gelion: %s\n\nCheck systemctl and journalctl on the VPS.\n' "$to" "$subject" | msmtp -t

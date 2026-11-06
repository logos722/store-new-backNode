#!/usr/bin/env bash
source /opt/gelion/bin/common.sh
lock
set -a
source /opt/gelion/backup.env
set +a
stage=$(mktemp -d /var/lib/gelion-backup.XXXXXX)
stopped=0
cleanup() {
  result=$?
  trap - EXIT
  if [[ $stopped == 1 ]]; then compose start backend || result=1; fi
  rm -f /opt/gelion/maintenance
  rm -rf -- "$stage"
  rm -f /var/lib/gelion-backup-current/*
  exit "$result"
}
trap cleanup EXIT
touch maintenance
stopped=1
compose stop -t 30 backend
# All application writes are stopped; credentials stay inside the Mongo container.
# shellcheck disable=SC2016 # Variables expand inside the container, not on the host.
compose exec -T mongo sh -c 'exec mongodump --host 127.0.0.1 --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db gelion --archive --gzip' >"$stage/mongo.archive.gz"
tar -C /opt/gelion/data -czf "$stage/files.tar.gz" images xml
cp images.env "$stage/images.env"
compose start backend
stopped=0
rm -f maintenance
# Keep a fixed path in restic so daily runs share one retention group.
mkdir -p /var/lib/gelion-backup-current
install -m 600 "$stage/"* /var/lib/gelion-backup-current/
restic backup --tag gelion /var/lib/gelion-backup-current
restic forget --tag gelion --group-by host,paths --keep-daily 14 --keep-weekly 8 --prune
restic check
date -u +%s >/opt/gelion/state/backup-success
rm -f /var/lib/gelion-backup-current/*

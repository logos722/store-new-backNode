#!/usr/bin/env bash
source /opt/gelion/bin/common.sh
[[ ${1:-} == --replace-catalog ]] || { echo 'Usage: import.sh --replace-catalog' >&2; exit 64; }
# backup.sh takes the same lock; finish the off-site backup BEFORE acquiring it here.
/opt/gelion/bin/backup.sh
lock
for file in import.xml offers.xml; do test -s "data/xml/$file"; done
# Parse and validate every product before stopping traffic or writing anything.
compose run --rm --no-deps backend node seed-from-xml.js --validate-only
cleanup() { result=$?; trap - EXIT; compose start backend || result=1; rm -f maintenance; exit "$result"; }
trap cleanup EXIT
touch maintenance
compose stop -t 30 backend
compose run --rm --no-deps backend node seed-from-xml.js --replace-catalog

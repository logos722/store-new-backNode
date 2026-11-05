#!/usr/bin/env bash
# Restores to a NEW isolated directory and Mongo container. Never overwrites production.
source /opt/gelion/bin/common.sh
[[ $# == 1 && $1 =~ ^[a-f0-9]{8,64}$ ]] || { echo 'Usage: restore-drill.sh <snapshot-id>'; exit 64; }
lock
set -a
source /opt/gelion/backup.env
set +a
target=$(mktemp -d /opt/gelion-restore.XXXXXX)
container="gelion-restore-$(date +%s)"
cleanup() { result=$?; trap - EXIT; docker rm -f "$container" >/dev/null 2>&1 || true; echo "Restored files retained in $target"; exit "$result"; }
trap cleanup EXIT
restic restore "$1" --target "$target"
archive="$target/var/lib/gelion-backup-current"
test -s "$archive/mongo.archive.gz"
mkdir "$target/files" "$target/mongo"
tar -xzf "$archive/files.tar.gz" -C "$target/files"
docker run -d --name "$container" --network none --env-file mongo.env \
  -v "$target/mongo:/data/db" -v /opt/gelion/mongo-init.js:/docker-entrypoint-initdb.d/gelion.js:ro mongo:8.0.16@sha256:4b58ebcb1dc7a7b4e84cd8ce9098d48764ae4478876898ff9551acf2ac4a6a6d >/dev/null
ready=0
for _ in {1..60}; do
  if docker exec "$container" sh -c 'mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "quit(db.adminCommand({ping:1}).ok ? 0 : 1)"' >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[[ $ready == 1 ]]
docker exec -i "$container" sh -c 'exec mongorestore --host 127.0.0.1 --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip' <"$archive/mongo.archive.gz"
docker exec "$container" sh -c 'mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin gelion --eval "printjson({products:db.products.countDocuments(),orders:db.orders.countDocuments(),users:db.users.countDocuments()})"'
test -d "$target/files/images"
echo 'Restore drill completed; inspect image samples and compare collection counts with production.'

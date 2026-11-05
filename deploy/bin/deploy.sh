#!/usr/bin/env bash
source /opt/gelion/bin/common.sh
[[ $# == 2 ]] || exit 64
service=$1
digest=$2
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 64
case "$service" in
  frontend) variable=FRONTEND_IMAGE; image=ghcr.io/logos722/store-new ;;
  backend) variable=BACKEND_IMAGE; image=ghcr.io/logos722/store-new-backnode ;;
  *) exit 64 ;;
esac
lock
current=$(sed -n "s/^${variable}=//p" images.env)
[[ "$current" =~ ^ghcr.io/logos722/[a-z-]+@sha256:[a-f0-9]{64}$ ]] || exit 65
candidate="$image@$digest"
docker pull "$candidate"
mkdir -p state
cp images.env state/images.before
rollback() {
  trap - ERR INT TERM
  cp state/images.before images.env
  if ! compose up -d --no-deps --wait --wait-timeout 120 "$service"; then
    logger -p daemon.crit 'Gelion deploy rollback FAILED; operator intervention required'
  fi
  logger -p daemon.err "Gelion $service deploy failed and rollback attempted"
  exit 1
}
trap rollback ERR INT TERM
sed -i "s|^${variable}=.*|${variable}=${candidate}|" images.env
compose up -d --no-deps --wait --wait-timeout 120 "$service"
curl --fail --silent --show-error --max-time 20 https://gelionaqua.ru/health >/dev/null
curl --fail --silent --show-error --max-time 20 https://gelionaqua.ru/health/ready >/dev/null
curl --fail --silent --show-error --max-time 20 https://gelionaqua.ru/api/categories >/dev/null
printf '%s\n' "$current" >"state/$service.previous"
printf '%s\n' "$candidate" >"state/$service.current"
trap - ERR INT TERM
logger "Gelion $service deployed $digest"

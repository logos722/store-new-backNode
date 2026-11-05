#!/usr/bin/env bash
set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/root
export DOCKER_CONFIG=/root/.docker
umask 077
cd /opt/gelion
compose() { docker compose --env-file /opt/gelion/images.env -f /opt/gelion/compose.yml "$@"; }
lock() { exec 9>/run/lock/gelion.lock; flock -w 900 9; }

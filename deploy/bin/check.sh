#!/usr/bin/env bash
source /opt/gelion/bin/common.sh
curl -fsS --max-time 15 https://gelionaqua.ru/health >/dev/null
curl -fsS --max-time 15 https://gelionaqua.ru/health/ready >/dev/null
percent=$(df --output=pcent /opt/gelion | tail -1 | tr -dc '0-9')
(( percent < 85 ))
openssl x509 -checkend 1209600 -noout -in /etc/letsencrypt/live/gelionaqua.ru/cert.pem
test -f state/backup-success
(( $(date -u +%s) - $(cat state/backup-success) < 129600 ))

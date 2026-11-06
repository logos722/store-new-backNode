#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 && $# == 2 ]] || { echo 'Usage: enable-tls.sh <acme-email> <reviewed-deploy-directory>'; exit 64; }
certbot certonly --webroot -w /var/www/letsencrypt -d gelionaqua.ru -d www.gelionaqua.ru --email "$1" --agree-tos --non-interactive
install -m 0644 "$2/nginx/https.conf" /etc/nginx/sites-available/gelion-https
ln -sfn /etc/nginx/sites-available/gelion-https /etc/nginx/sites-enabled/gelion-https
install -d /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nnginx -t && systemctl reload nginx\n' >/etc/letsencrypt/renewal-hooks/deploy/gelion
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/gelion
nginx -t
systemctl reload nginx
certbot renew --dry-run

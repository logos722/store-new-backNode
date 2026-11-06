#!/usr/bin/env bash
# Run as root on a fresh Ubuntu 24.04 VPS from the reviewed deploy directory.
set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
[[ $EUID == 0 ]] || exit 77
source /etc/os-release
[[ $ID == ubuntu && $VERSION_ID == 24.04 ]] || { echo 'Ubuntu 24.04 required'; exit 65; }
root=$(cd "$(dirname "$0")/.." && pwd)
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg nginx certbot ufw fail2ban unattended-upgrades restic msmtp-mta openssl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable\n' "$(dpkg --print-architecture)" >/etc/apt/sources.list.d/docker.list
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
install -d -m 0755 /opt/gelion /opt/gelion/bin /opt/gelion/data /opt/gelion/data/images /opt/gelion/data/xml /var/www/letsencrypt
install -d -m 0700 /opt/gelion/secrets /opt/gelion/state /opt/gelion/data/mongo
install -m 0644 "$root/compose.yml" "$root/mongo-init.js" /opt/gelion/
install -m 0755 "$root/bin/"*.sh /opt/gelion/bin/
install -m 0644 "$root/systemd/"* /etc/systemd/system/
install -m 0644 "$root/nginx/http.conf" /etc/nginx/sites-available/gelion-http
ln -sfn /etc/nginx/sites-available/gelion-http /etc/nginx/sites-enabled/gelion-http
if [[ -L /etc/nginx/sites-enabled/default ]]; then unlink /etc/nginx/sites-enabled/default; fi
id gelion-deploy >/dev/null 2>&1 || useradd -m -s /bin/bash gelion-deploy
# Root-owned authorized_keys prevents the deploy account replacing its forced command.
install -d -m 0755 /etc/ssh/authorized_keys
printf 'Match User gelion-deploy\n    AuthorizedKeysFile /etc/ssh/authorized_keys/gelion-deploy\n    PasswordAuthentication no\n    AllowTcpForwarding no\n    X11Forwarding no\n    PermitTTY no\nMatch all\n' >/etc/ssh/sshd_config.d/40-gelion-deploy.conf
printf 'gelion-deploy ALL=(root) NOPASSWD: /opt/gelion/bin/deploy.sh\n' >/etc/sudoers.d/gelion-deploy
chmod 0440 /etc/sudoers.d/gelion-deploy
visudo -cf /etc/sudoers.d/gelion-deploy
printf '[sshd]\nenabled = true\nbackend = systemd\nmaxretry = 5\nbantime = 1h\n' >/etc/fail2ban/jail.d/gelion.local
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
nginx -t
sshd -t
systemctl daemon-reload
systemctl enable --now docker nginx fail2ban unattended-upgrades certbot.timer
systemctl reload nginx ssh
echo 'Base installation complete. Follow RUNBOOK.md for secrets, TLS, first release and timers.'

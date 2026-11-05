#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
fixture=$(mktemp -d)
trap 'rm -rf -- "$fixture"' EXIT
mkdir -p "$fixture/bin" "$fixture/mock" "$fixture/state"
sed "s|/opt/gelion|$fixture|g; s|/run/lock/gelion.lock|$fixture/lock|g; s|export PATH=.*|export PATH=$fixture/mock:/usr/bin:/bin|" "$root/bin/common.sh" >"$fixture/bin/common.sh"
sed "s|/opt/gelion|$fixture|g" "$root/bin/deploy.sh" >"$fixture/bin/deploy.sh"
cat >"$fixture/mock/docker" <<'SH'
#!/usr/bin/env bash
echo "$*" >>docker.calls
if [[ $* == *'up -d'* && -f fail-update ]]; then rm fail-update; exit 1; fi
SH
printf '#!/bin/sh\nexit 0\n' >"$fixture/mock/curl"
printf '#!/bin/sh\nexit 0\n' >"$fixture/mock/logger"
chmod +x "$fixture/mock/"*
old=$(printf a%.0s {1..64})
new=$(printf b%.0s {1..64})
printf 'FRONTEND_IMAGE=ghcr.io/logos722/store-new@sha256:%s\nBACKEND_IMAGE=ghcr.io/logos722/store-new-backnode@sha256:%s\n' "$old" "$old" >"$fixture/images.env"
bash "$fixture/bin/deploy.sh" frontend "sha256:$new"
grep -q "FRONTEND_IMAGE=.*$new" "$fixture/images.env"
grep -q "BACKEND_IMAGE=.*$old" "$fixture/images.env"
grep -q "$old" "$fixture/state/frontend.previous"
touch "$fixture/fail-update"
if bash "$fixture/bin/deploy.sh" backend "sha256:$new"; then echo 'Expected update failure'; exit 1; fi
grep -q "BACKEND_IMAGE=.*$old" "$fixture/images.env"
if bash "$fixture/bin/deploy.sh" mongo "sha256:$new"; then exit 1; fi
if bash "$fixture/bin/deploy.sh" backend latest; then exit 1; fi
if grep -q ' down' "$fixture/docker.calls"; then exit 1; fi
echo 'Deploy success, service isolation, rollback and input validation passed'

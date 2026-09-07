#!/usr/bin/env bash
set -euo pipefail
# Uses localhost's disposable local CA, NOT public ACME or real domains.
docker run -d --name fintrack-edge --network fintrack-ci --read-only --cap-drop ALL --security-opt no-new-privileges \
 --tmpfs /data:rw,uid=65532,gid=65532,size=32m --tmpfs /config:rw,uid=65532,gid=65532,size=8m \
 -p 127.0.0.1:18443:8443 -p 127.0.0.1:18080:8080 -e APP_DOMAIN=localhost -e ACME_EMAIL=ci@example.test fintrack-edge:ci
ready=false
for i in $(seq 1 30);do
 if docker cp fintrack-edge:/data/caddy/pki/authorities/local/root.crt /tmp/fintrack-root.crt >/dev/null 2>&1;then ready=true;break;fi
 sleep 1
done
$ready
curl --fail --silent --show-error --retry 5 --retry-connrefused --cacert /tmp/fintrack-root.crt https://localhost:18443/readyz >/dev/null
curl --fail --silent --show-error --cacert /tmp/fintrack-root.crt -D /tmp/fintrack-tls-headers https://localhost:18443/ >/dev/null
grep -iq 'strict-transport-security: max-age=31536000' /tmp/fintrack-tls-headers
curl --silent -D /tmp/fintrack-redirect http://localhost:18080/login >/dev/null
grep -iq 'location: https://localhost/login' /tmp/fintrack-redirect
echo 'Non-root read-only TLS edge, certificate validation and HTTPS redirect passed'

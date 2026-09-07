#!/usr/bin/env bash
set -euo pipefail
trap 'docker logs --tail 60 fintrack-edge >&2 || true' ERR
# The prior API smoke explicitly stops it to verify graceful shutdown.
docker start fintrack-api >/dev/null
# Uses localhost's disposable local CA, NOT public ACME or real domains.
docker run -d --name fintrack-edge --network fintrack-ci --read-only --cap-drop ALL --security-opt no-new-privileges \
 --tmpfs /tmp:rw,nosuid,noexec,size=16m --tmpfs /data:rw,uid=65532,gid=65532,size=32m --tmpfs /config:rw,uid=65532,gid=65532,size=8m \
 -p 127.0.0.1:18443:8443 -p 127.0.0.1:18080:8080 -e APP_DOMAIN=localhost -e ACME_EMAIL=ci@example.test fintrack-edge:ci
ready=false
for i in $(seq 1 30);do
 # The edge runs as uid 65532 and owns the tmpfs-backed Caddy storage. Read the
 # disposable CA through that same process context instead of docker cp, which
 # cannot traverse this hardened tmpfs layout reliably on hosted runners.
 if docker exec fintrack-edge cat /data/caddy/pki/authorities/local/root.crt > /tmp/fintrack-root.crt 2>/dev/null && test -s /tmp/fintrack-root.crt;then
  ready=true
  break
 fi
 sleep 1
done
$ready
# The ports are intentionally bound to IPv4 loopback only. Keep the TLS hostname
# as localhost while pinning transport resolution to 127.0.0.1 so runner IPv6
# preference cannot turn a healthy edge into a connection-refused false negative.
curl --fail --silent --show-error --retry 5 --retry-connrefused \
 --resolve localhost:18443:127.0.0.1 --cacert /tmp/fintrack-root.crt \
 https://localhost:18443/readyz >/dev/null
curl --fail --silent --show-error \
 --resolve localhost:18443:127.0.0.1 --cacert /tmp/fintrack-root.crt \
 -D /tmp/fintrack-tls-headers https://localhost:18443/ >/dev/null
grep -iq 'strict-transport-security: max-age=31536000' /tmp/fintrack-tls-headers
curl --fail --silent --show-error --resolve localhost:18080:127.0.0.1 \
 -D /tmp/fintrack-redirect http://localhost:18080/login >/dev/null
grep -iq 'location: https://localhost/login' /tmp/fintrack-redirect
echo 'Non-root read-only TLS edge, certificate validation and HTTPS redirect passed'

#!/usr/bin/env bash
set -euo pipefail
# Fixtures only: do not set real cloud credentials in this job.
docker run -d --name fintrack-api --network fintrack-ci --network-alias api   --read-only --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp:rw,noexec,nosuid,size=16m   -e APP_ENV=production -e 'MONGO_URI=mongodb://mongo:27017/?replicaSet=rs0'   -e MONGO_DATABASE=fintrack_smoke -e SUPABASE_URL=https://test.supabase.co   -e SUPABASE_ANON_KEY=public-test-only -e ALLOWED_ORIGINS=https://app.test   fintrack-api:ci
for attempt in $(seq 1 60); do
  if docker exec fintrack-api /app/fintrack healthcheck; then break; fi
  sleep 1
done
docker run -d --name fintrack-web --network fintrack-ci   --read-only --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp:rw,noexec,nosuid,size=16m   -p 127.0.0.1:8088:8080 fintrack-web:ci
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:8088/healthz; then break; fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:8088/readyz | grep 'ready'
curl --fail --silent http://127.0.0.1:8088/home | grep '<div id="root">'
[ "$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:8088/api/accounts/get-since/1970-01-01T00:00:00Z)" = 401 ]
curl --fail --silent --head http://127.0.0.1:8088/ | grep -i 'content-security-policy:'
[ "$(docker inspect --format '{{.Config.User}}' fintrack-api)" = '65532:65532' ]
[ "$(docker inspect --format '{{.Config.User}}' fintrack-web)" = '101:101' ]
docker stop --time 20 fintrack-api
[ "$(docker inspect --format '{{.State.ExitCode}}' fintrack-api)" = 0 ]

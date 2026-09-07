#!/usr/bin/env bash
set -euo pipefail
# Synthetic, loopback-only database. Never use a production URL here.
docker rm -f fintrack-postgres >/dev/null 2>&1 || true
docker network inspect fintrack-ci >/dev/null 2>&1 || docker network create fintrack-ci >/dev/null
docker run -d --name fintrack-postgres --network fintrack-ci --network-alias postgres \
  -e POSTGRES_USER=fintrack -e POSTGRES_PASSWORD=fintrack -e POSTGRES_DB=fintrack \
  -p 127.0.0.1:55432:5432 postgres:18-alpine >/dev/null
# The image starts a temporary socket-only server while initializing. A socket
# pg_isready check can pass before the final network listener has even started.
for i in $(seq 1 60); do
  if docker exec -e PGPASSWORD=fintrack fintrack-postgres \
    psql -h 127.0.0.1 -U fintrack -d fintrack -Atqc 'SELECT 1' >/dev/null 2>&1; then
    exit 0
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' fintrack-postgres)" != true ]; then break; fi
  sleep 1
done
docker logs --tail 100 fintrack-postgres >&2
exit 1

#!/usr/bin/env bash
set -euo pipefail
docker rm -f fintrack-postgres >/dev/null 2>&1 || true
docker network create fintrack-ci >/dev/null 2>&1 || true
docker run -d --name fintrack-postgres --network fintrack-ci --network-alias postgres \
  -e POSTGRES_USER=fintrack -e POSTGRES_PASSWORD=fintrack -e POSTGRES_DB=fintrack \
  -p 127.0.0.1:55432:5432 postgres:18-alpine >/dev/null
for i in $(seq 1 60); do
  if docker exec fintrack-postgres pg_isready -U fintrack -d fintrack >/dev/null 2>&1; then exit 0; fi
  sleep 1
done
docker logs fintrack-postgres >&2
exit 1

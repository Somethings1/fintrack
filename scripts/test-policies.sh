#!/usr/bin/env bash
set -euo pipefail
# All data is synthetic; this never accepts a production connection string.
name="fintrack-policy-ci"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$name" -e POSTGRES_PASSWORD=local-ci-only postgres:17-alpine >/dev/null
ready=false
for i in $(seq 1 60); do
  if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
$ready
for file in tests/sql/bootstrap.sql query.sql deploy/profiles-rls.sql deploy/avatar-rls.sql tests/sql/isolation.sql; do
  docker exec -i -e PGPASSWORD=local-ci-only "$name" psql -h 127.0.0.1 -X -v ON_ERROR_STOP=1 -U postgres < "$file"
done

#!/usr/bin/env bash
set -euo pipefail
mkdir -p e2e/fixture-logs
export FINTRACK_CI=1 MONGO_TEST_URI='mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true'
(cd server && go test -c -tags=browser -o /tmp/fintrack-browser.test .)
/tmp/fintrack-browser.test -test.run '^TestBrowserHarness$' -test.timeout 12m >e2e/fixture-logs/api.log 2>&1 &
api=$!
node e2e/serve.mjs >e2e/fixture-logs/web.log 2>&1 &
web=$!
trap 'kill "$api" "$web" 2>/dev/null || true; wait "$api" 2>/dev/null || true' EXIT
ready=false
for i in $(seq 1 60);do
 if curl --fail --silent http://127.0.0.1:5173/readyz >/dev/null;then ready=true;break;fi
 sleep 1
done
$ready
npm --prefix e2e test

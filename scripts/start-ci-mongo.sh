#!/usr/bin/env bash
set -euo pipefail
docker network create fintrack-ci
docker run -d --name fintrack-mongo --network fintrack-ci --network-alias mongo   -p 127.0.0.1:27017:27017 mongo:7.0 mongod --replSet rs0 --bind_ip_all
for attempt in $(seq 1 60); do
  if docker exec fintrack-mongo mongosh --quiet --eval 'quit(db.adminCommand({ping:1}).ok ? 0 : 1)' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec fintrack-mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"mongo:27017"}]})'
for attempt in $(seq 1 60); do
  if docker exec fintrack-mongo mongosh --quiet --eval 'quit(db.hello().isWritablePrimary ? 0 : 1)' >/dev/null 2>&1; then exit 0; fi
  sleep 1
done
echo 'MongoDB did not become writable' >&2
exit 1

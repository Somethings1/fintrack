#!/usr/bin/env bash
# Synthetic, disposable drill. Never points to an operator-provided URI.
set -euo pipefail
work=$(mktemp -d)
trap 'docker run --rm --user 0 --entrypoint sh -v "$work:/backup" fintrack-backup:ci -c "rm -f /backup/*" >/dev/null 2>&1 || true; rmdir "$work" 2>/dev/null || true' EXIT
export MONGO_URI='mongodb://fintrack-mongo:27017/?replicaSet=rs0&directConnection=true'
# Private directory is owned by the non-root backup container.
chmod 700 "$work"
docker run --rm --user 0 --entrypoint sh -v "$work:/backup" fintrack-backup:ci -c 'chown 65532:65532 /backup'
docker exec fintrack-mongo mongosh --quiet --eval '
 const d=db.getSiblingDB("fintrack_backup_ci");
 d.accounts.insertOne({_id:ObjectId("111111111111111111111111"),owner:"synthetic",currency:"USD",balance:NumberDecimal("0.30"),opening_balance:NumberDecimal("0.30")});
 d.accounts.createIndex({owner:1,last_update:1,_id:1});
 d.transactions.createIndex({creator:1,idempotency_key:1},{unique:true,partialFilterExpression:{idempotency_key:{$type:"string"}}});
 d.transactions.insertOne({creator:"synthetic",idempotency_key:"one",amount:NumberDecimal("0.10"),is_deleted:true});
 d.schema_metadata.insertOne({_id:"money_v1",currency:"USD",version:1});
' >/dev/null
# Only disposable keys; never upload these or the archive as CI artifacts.
docker run --rm --entrypoint age-keygen -v "$work:/backup" fintrack-backup:ci -o /backup/key.txt 2>/dev/null
recipient=$(docker run --rm --entrypoint age-keygen -v "$work:/backup:ro" fintrack-backup:ci -y /backup/key.txt)
backup() { docker run --rm --network fintrack-ci --read-only --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp:rw,nosuid,noexec,size=64m -e MONGO_URI -e AGE_RECIPIENT="$recipient" -e AGE_IDENTITY_FILE=/backup/key.txt -v "$work:/backup" fintrack-backup:ci "$@"; }
backup backup --database fintrack_backup_ci --archive /backup/snapshot.age --apply --writers-stopped
checksum=$(docker run --rm --entrypoint sha256sum -v "$work:/backup:ro" fintrack-backup:ci /backup/snapshot.age | cut -d' ' -f1)
if backup restore --database fintrack_backup_ci --target fintrack_restore_bad --archive /backup/snapshot.age --expected-sha256 "$(printf '%064d' 0)" --apply;then echo 'Corrupt-checksum guard failed';exit 1;fi
backup restore --database fintrack_backup_ci --target fintrack_restore_ci --archive /backup/snapshot.age --expected-sha256 "$checksum" --apply
if backup restore --database fintrack_backup_ci --target fintrack_restore_ci --archive /backup/snapshot.age --expected-sha256 "$checksum" --apply;then echo 'Non-empty target guard failed';exit 1;fi
backup check-age --archive /backup/snapshot.age --max-age-hours 1
docker exec fintrack-mongo mongosh --quiet --eval '
 const d=db.getSiblingDB("fintrack_restore_ci");
 if(d.accounts.countDocuments({balance:{$type:"decimal"}})!==1)throw Error("Decimal precision lost");
 let denied=false;try{d.transactions.insertOne({creator:"synthetic",idempotency_key:"one"});}catch(e){denied=e.code===11000;}
 if(!denied)throw Error("Idempotency index missing");
' >/dev/null
echo 'Encrypted restore drill passed, including precision, checksums, unique indexes and refusal to overwrite.'
# Clean non-root files through the image; host runner is not their owner.
docker run --rm --user 0 --entrypoint sh -v "$work:/backup" fintrack-backup:ci -c 'rm -f /backup/*'

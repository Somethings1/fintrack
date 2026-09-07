#!/usr/bin/env python3
"""Encrypted, fail-closed, offline MongoDB backup/restore. See docs/operations.md.
No live operation without --apply. Never restores over an existing database.
"""
import argparse
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]


def run(command, **kwargs):
    # Tools can include secrets or data in errors: deliberately never echo stderr.
    result = subprocess.run(command, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        raise RuntimeError(f"{command[0]} failed (details suppressed to protect credentials/data)")
    return result


def inventory(database, empty=False):
    env = dict(os.environ, BACKUP_DATABASE=database, BACKUP_REQUIRE_EMPTY='1' if empty else '0')
    result = run(['mongosh', '--nodb', '--quiet', '--file', str(ROOT/'deploy/backup/inventory.js')],
                 env=env, stdout=subprocess.PIPE, timeout=600)
    return json.loads(result.stdout)


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024*1024), b''):
            value.update(chunk)
    return value.hexdigest()


def pipe(commands, destination):
    """Stream without plaintext files; check every child, including the producer."""
    children = []
    previous = None
    try:
        for i, command in enumerate(commands):
            child = subprocess.Popen(command, stdin=previous,
                                     stdout=destination if i == len(commands)-1 else subprocess.PIPE,
                                     stderr=subprocess.DEVNULL)
            children.append(child)
            if previous is not None:
                previous.close()
            previous = child.stdout
        if any(code != 0 for code in [child.wait(timeout=1800) for child in reversed(children)]):
            raise RuntimeError('Archive pipeline failed; partial output must not be used')
    finally:
        for child in children:
            if child.poll() is None:
                child.kill()
            child.wait()


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['backup','restore','check-age'])
    parser.add_argument('--database')
    parser.add_argument('--archive', type=pathlib.Path, required=True)
    parser.add_argument('--target')
    parser.add_argument('--expected-sha256')
    parser.add_argument('--max-age-hours', type=int, default=26)
    parser.add_argument('--writers-stopped', action='store_true')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    manifest_path = pathlib.Path(str(args.archive)+'.manifest.json')
    if args.operation == 'check-age':
        manifest = json.loads(manifest_path.read_text())
        age = time.time()-manifest['created_at']
        if args.max_age_hours < 1 or not 0 <= age <= args.max_age_hours*3600 or digest(args.archive) != manifest['sha256']:
            raise RuntimeError('Backup absent, stale or corrupt')
        print('Backup freshness and checksum verified'); return
    if not args.database or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,62}', args.database) or args.database in {'admin','local','config'}:
        raise ValueError('Explicit application database required')
    if args.operation == 'restore' and (not args.target or not re.fullmatch(r'fintrack_restore_[a-z0-9_]{1,40}',args.target) or args.target == args.database):
        raise ValueError('Restore requires a distinct fresh fintrack_restore_<name> target')
    if not args.apply:
        print(json.dumps({'operation':args.operation,'database':args.database,'target':args.target,'mode':'dry-run; no connection opened'})); return
    uri = os.environ.get('MONGO_URI','')
    if not uri.startswith(('mongodb://','mongodb+srv://')):
        raise ValueError('MONGO_URI must be supplied through the environment')
    with tempfile.TemporaryDirectory(prefix='fintrack-backup-') as temp:
        config = pathlib.Path(temp)/'tools.json'
        config.write_text(json.dumps({'uri':uri})); config.chmod(0o600)
        if args.operation == 'backup':
            recipient = os.environ.get('AGE_RECIPIENT','')
            if not recipient.startswith('age1') or not args.writers_stopped:
                raise ValueError('Public AGE_RECIPIENT and --writers-stopped attestation required')
            if args.archive.exists() or manifest_path.exists():
                raise ValueError('Refusing to overwrite an archive or manifest')
            before = inventory(args.database)
            if not before:
                raise ValueError('Refusing an empty backup')
            try:
                with args.archive.open('xb') as output:
                    pipe([['mongodump','--config='+str(config),'--db='+args.database,'--readPreference=primary','--archive','--gzip','--quiet'],
                          ['age','--encrypt','--recipient',recipient]],output)
                    output.flush();os.fsync(output.fileno())
                if inventory(args.database) != before:
                    raise RuntimeError('Database changed during backup; stop every writer')
                manifest = {'version':1,'database':args.database,'created_at':time.time(),'sha256':digest(args.archive),'inventory':before}
                with manifest_path.open('x') as output:
                    json.dump(manifest,output,sort_keys=True);output.flush();os.fsync(output.fileno())
                print('Encrypted archive and private verification manifest created')
            except BaseException:
                args.archive.unlink(missing_ok=True);manifest_path.unlink(missing_ok=True);raise
        else:
            expected=args.expected_sha256 or ''
            if not re.fullmatch(r'[a-f0-9]{64}',expected) or digest(args.archive)!=expected:
                raise ValueError('Restore requires the reviewed archive SHA-256; mismatch refused')
            manifest=json.loads(manifest_path.read_text())
            if manifest.get('version')!=1 or manifest['database']!=args.database or manifest['sha256']!=expected:
                raise ValueError('Manifest does not match the approved backup')
            identity=os.environ.get('AGE_IDENTITY_FILE','')
            key=pathlib.Path(identity)
            if not identity or not key.is_file() or key.stat().st_mode & 0o077:
                raise ValueError('AGE_IDENTITY_FILE must be a private mode-0600 file')
            inventory(args.target,empty=True)
            with open(os.devnull,'wb') as output:
                pipe([['age','--decrypt','--identity',identity,str(args.archive)],
                      ['mongorestore','--config='+str(config),'--archive','--gzip','--stopOnError','--quiet',
                       '--nsInclude='+args.database+'.*','--nsFrom='+args.database+'.*','--nsTo='+args.target+'.*']],output)
            if inventory(args.target)!=manifest['inventory']:
                raise RuntimeError('Restored documents/indexes/options differ; do not promote this target')
            print('Restored to a fresh isolated database; documents, indexes and options verified')


if __name__=='__main__':
    try:
        main()
    except Exception as error:
        # No tool output, credential-bearing URIs or financial records in console.
        print(f'Backup operation refused or failed: {type(error).__name__}. Consult the runbook; live data was not overwritten.',file=sys.stderr)
        raise SystemExit(1)

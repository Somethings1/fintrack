#!/usr/bin/env python3
"""Manual, protected main-branch image publication. Never deploys an application."""
import argparse
import json
import os
import pathlib
import re
import subprocess
import urllib.request

EXPECTED_JOBS = {'backend','frontend','containers','Policy isolation','Browser acceptance','Encrypted restore drill','Required CI'}


def validate_evidence(sha, branch, run, jobs, environment, rules):
    if branch != 'refs/heads/main' or run.get('head_sha') != sha or run.get('head_branch') != 'main' or run.get('event') != 'push' or run.get('status') != 'completed' or run.get('conclusion') != 'success':
        raise ValueError('A successful main-branch push CI run is required for this exact commit')
    actual={j['name']:j for j in jobs}
    if any(n not in actual or actual[n].get('conclusion')!='success' or actual[n].get('status')!='completed' for n in EXPECTED_JOBS):
        raise ValueError('Every required test tier must pass; skipped jobs are not approval')
    approvals=[r for r in environment.get('protection_rules',[]) if r.get('type')=='required_reviewers' and r.get('reviewers')]
    if not approvals or not all(r.get('prevent_self_review') for r in approvals):
        raise ValueError('release environment requires reviewers and prevention of self-review')
    if environment.get('can_admins_bypass', True):
        raise ValueError('release environment must prohibit administrator bypass')
    types={r['type'] for r in rules}
    if not {'pull_request','required_status_checks','non_fast_forward','deletion'} <= types:
        raise ValueError('Active main-branch rules are missing')
    prs=[r['parameters'] for r in rules if r['type']=='pull_request']
    checks=[r['parameters'] for r in rules if r['type']=='required_status_checks']
    if not any(p.get('required_approving_review_count',0)>=1 and p.get('dismiss_stale_reviews_on_push') and p.get('require_last_push_approval') and p.get('required_review_thread_resolution') for p in prs):
        raise ValueError('Human code review must be enforced')
    if not any(c.get('strict_required_status_checks_policy') and any(x.get('context')=='Required CI' and x.get('integration_id') for x in c.get('required_status_checks',[])) for c in checks):
        raise ValueError('Required CI must be an enforced, application-bound, up-to-date status check')


def get(path):
    token=os.environ['GH_TOKEN']
    request=urllib.request.Request('https://api.github.com/'+path,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'})
    with urllib.request.urlopen(request,timeout=20) as response:
        return json.load(response)


def preflight():
    repo=os.environ['GITHUB_REPOSITORY'];sha=os.environ['GITHUB_SHA']
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repo) or not re.fullmatch('[a-f0-9]{40}',sha):
        raise ValueError('Invalid release identity')
    prefix='repos/'+repo
    if get(prefix+'/git/ref/heads/main')['object']['sha']!=sha:
        raise ValueError('main advanced; review and dispatch a new release')
    runs=get(prefix+'/actions/workflows/ci.yml/runs?head_sha='+sha+'&event=push&per_page=10')['workflow_runs']
    if not runs: raise ValueError('No CI evidence')
    run=max(runs,key=lambda r:r['id'])
    jobs=get(prefix+'/actions/runs/'+str(run['id'])+'/jobs?filter=latest&per_page=100')['jobs']
    environment=get(prefix+'/environments/release')
    rules=get(prefix+'/rules/branches/main?per_page=100')
    validate_evidence(sha,os.environ['GITHUB_REF'],run,jobs,environment,rules)
    return repo,sha,run['id']


def command(*args,**kwargs):
    subprocess.run(args,check=True,timeout=1200,**kwargs)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--publish',action='store_true');args=parser.parse_args()
    repo,sha,ci_run=preflight()
    if not args.publish: print('Release evidence and governance verified');return
    url=os.environ.get('PUBLIC_SUPABASE_URL','');key=os.environ.get('PUBLIC_SUPABASE_ANON_KEY','')
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co',url) or not key:
        raise ValueError('Set public Supabase project URL and anonymous key in release environment variables')
    # Never allow a known elevated key to enter a browser build.
    if key.startswith('sb_secret_'):raise ValueError('Secret Supabase key is forbidden')
    if key.count('.')==2:
        import base64
        claims=json.loads(base64.urlsafe_b64decode(key.split('.')[1]+'==='))
        if claims.get('role')!='anon':raise ValueError('Only the anon role is permitted in the web bundle')
    elif not key.startswith('sb_publishable_'):
        raise ValueError('Only an anonymous JWT or Supabase publishable key is allowed')
    tag=sha+'-'+os.environ['GITHUB_RUN_ID']+'-'+os.environ.get('GITHUB_RUN_ATTEMPT','1')
    prefix='ghcr.io/'+repo.lower()
    images={component:prefix+'-'+component+':'+tag for component in ('api','web','edge')}
    paths={'api':'server','web':'web','edge':'deploy/edge'}
    output=pathlib.Path('release-evidence');output.mkdir(exist_ok=True)
    for component,image in images.items():
        extra=[]
        if component=='web':extra=['--build-arg','VITE_SUPABASE_URL='+url,'--build-arg','VITE_SUPABASE_ANON_KEY='+key]
        command('docker','build','--pull','--label','org.opencontainers.image.source=https://github.com/'+repo,'--label','org.opencontainers.image.revision='+sha,'-t',image,*extra,paths[component])
        command('docker','tag',image,'fintrack-'+component+':ci')
    # Smoke the actual candidate images before any registry publication.
    command('bash','scripts/start-ci-mongo.sh');command('bash','scripts/container-smoke.sh');command('bash','scripts/test-edge.sh')
    for component,image in images.items():
        archive=output/(component+'.tar');command('docker','save',image,'-o',str(archive))
        mount=str(output.resolve())+':/scan'
        command('docker','run','--rm','-v',mount,'aquasec/trivy:0.74.0','image','--input','/scan/'+component+'.tar','--scanners','vuln','--severity','HIGH,CRITICAL','--exit-code','1')
        command('docker','run','--rm','-v',mount,'aquasec/trivy:0.74.0','image','--input','/scan/'+component+'.tar','--format','cyclonedx','--output','/scan/'+component+'.cdx.json')
        archive.unlink()
    preflight() # Recheck exact main and CI after builds, before publishing.
    command('docker','login','ghcr.io','-u',os.environ['GITHUB_ACTOR'],'--password-stdin',input=os.environ['GH_TOKEN'].encode())
    digests={}
    try:
        for component,image in images.items():
            command('docker','push',image)
            values=json.loads(subprocess.check_output(['docker','image','inspect',image,'--format','{{json .RepoDigests}}'],timeout=20))
            expected=image.rsplit(':',1)[0]+'@sha256:'
            matches=[v for v in values if v.startswith(expected)]
            if len(matches)!=1:raise ValueError('Ambiguous published digest')
            digests[component]=matches[0]
    finally:command('docker','logout','ghcr.io')
    (output/'manifest.json').write_text(json.dumps({'repository':repo,'commit':sha,'ci_run':ci_run,'workflow_run':os.environ['GITHUB_RUN_ID'],'images':digests},indent=2)+'\n')
    print('Images published; deploy only the exact digests in the manifest. No deployment was performed.')


if __name__=='__main__':
    try: main()
    except Exception as error:
        print('Release refused or failed: '+type(error).__name__+'; check the governance/configuration runbook.')
        raise SystemExit(1)

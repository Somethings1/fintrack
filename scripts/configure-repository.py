#!/usr/bin/env python3
"""Owner-run administrative setup. Dry-run by default; never executed by CI.
An additional independent collaborator must approve PRs and releases. Does not
replace/delete existing rulesets or environment policies without review.
"""
import argparse
import json
import pathlib
import re
import subprocess


def api(path,method='GET',data=None):
    args=['gh','api','--method',method,path]
    if data is not None:args+=['--input','-']
    return json.loads(subprocess.check_output(args,input=None if data is None else json.dumps(data).encode(),timeout=30))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reviewer',required=True,help='Independent GitHub collaborator login (not the release initiator)')
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,38}",args.reviewer):
        raise ValueError("Invalid GitHub reviewer login")
    # Fixed repository: no accidental mutation of whichever repo gh happens to select.
    repo='longnt27/fintrack';base='repos/'+repo
    if not args.apply:
        print(json.dumps({'repository':repo,'reviewer':args.reviewer,'rules':json.loads((pathlib.Path(__file__).resolve().parents[1]/'deploy/repository-rules.json').read_text()),'environment':'release; require independent reviewer; prevent self-review and admin bypass; main-only'},indent=2));return
    reviewer=api('users/'+args.reviewer)
    access=api(base+'/collaborators/'+args.reviewer+'/permission')
    if access.get('permission') not in {'write','maintain','admin'}:
        raise ValueError('Reviewer must have repository write access to approve changes')
    rules=json.loads((pathlib.Path(__file__).resolve().parents[1]/'deploy/repository-rules.json').read_text())
    existing=api(base+'/rulesets?per_page=100')
    if len(existing)>=100 or any(r['name']==rules['name'] for r in existing):
        raise RuntimeError('Ruleset exists or listing is incomplete; inspect it instead of overwriting')
    # No existing environment is overwritten. Configure it manually if already present.
    environments=api(base+'/environments?per_page=100')
    if environments.get('total_count',0)>=100 or any(e['name']=='release' for e in environments.get('environments',[])):
        raise RuntimeError('release environment exists or listing is incomplete; review it manually')
    app=api('apps/github-actions')
    for rule in rules['rules']:
        if rule['type']=='required_status_checks':rule['parameters']['required_status_checks'][0]['integration_id']=app['id']
    # Additive rules preserve any stricter existing rules. Two non-atomic writes:
    # on failure inspect partial state before retrying; never silently roll back protection.
    result=api(base+'/rulesets','POST',rules)
    api(base+'/environments/release','PUT',{'reviewers':[{'type':'User','id':reviewer['id']}], 'prevent_self_review':True,'can_admins_bypass':False,'deployment_branch_policy':{'protected_branches':False,'custom_branch_policies':True}})
    api(base+'/environments/release/deployment-branch-policies','POST',{'name':'main','type':'branch'})
    print('Added ruleset '+str(result['id'])+' and protected release environment. Existing rules were not removed.')


if __name__=='__main__':main()

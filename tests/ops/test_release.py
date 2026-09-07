import copy
import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('release',pathlib.Path(__file__).resolve().parents[2]/'scripts/release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)

class ReleaseGuards(unittest.TestCase):
    def fixture(self):
        sha='a'*40
        return [sha,'refs/heads/main',{'head_sha':sha,'head_branch':'main','event':'push','status':'completed','conclusion':'success'},
                [{'name':name,'status':'completed','conclusion':'success'} for name in release.EXPECTED_JOBS],
                {'can_admins_bypass':False,'protection_rules':[{'type':'required_reviewers','prevent_self_review':True,'reviewers':[{'type':'User','id':1}]}]},
                [{'type':'deletion'},{'type':'non_fast_forward'},
                 {'type':'pull_request','parameters':{'required_approving_review_count':1,'dismiss_stale_reviews_on_push':True,'require_last_push_approval':True,'required_review_thread_resolution':True}},
                 {'type':'required_status_checks','parameters':{'strict_required_status_checks_policy':True,'required_status_checks':[{'context':'Required CI','integration_id':1}]}}]]
    def test_all_gates_required(self):
        release.validate_evidence(*self.fixture())
        for name in release.EXPECTED_JOBS:
            values=self.fixture();values[3]=[j for j in values[3] if j['name']!=name]
            with self.assertRaises(ValueError):release.validate_evidence(*values)
    def test_skipped_or_failed_jobs_cannot_release(self):
        for result in ['skipped','cancelled','failure',None]:
            values=self.fixture();values[3][0]['conclusion']=result
            with self.assertRaises(ValueError):release.validate_evidence(*values)
    def test_wrong_commit_branch_and_pr_runs(self):
        for index,key,value in [(1,None,'refs/heads/dev'),(2,'head_sha','b'*40),(2,'event','pull_request'),(2,'conclusion','failure')]:
            values=self.fixture()
            if key:values[index][key]=value
            else:values[index]=value
            with self.assertRaises(ValueError):release.validate_evidence(*values)
    def test_unprotected_releases_refused(self):
        for env in [{},{'can_admins_bypass':True,'protection_rules':[]}]:
            values=self.fixture();values[4]=env
            with self.assertRaises(ValueError):release.validate_evidence(*values)
        values=self.fixture();values[5]=[]
        with self.assertRaises(ValueError):release.validate_evidence(*values)

if __name__=='__main__':unittest.main()

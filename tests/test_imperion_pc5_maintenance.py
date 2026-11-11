"""Synthetic, no-network tests for Windows Agent #5 maintenance review code."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parents[1] / 'ops' / 'pc-agent'
sys.path.insert(0, str(HERE))
import pc5_maintenance as pc5
import pc5_adapter_hook as hook

ID = 'IMP-PC5-MAINT-20261110-UNIT01'


def fixture(ident=ID):
    return {
        'case_id': 'IMP-PC5-MAINT-20261110',
        'audit_id': ident,
        'summary': {
            'ram_total_mb': 16384,
            'ram_available_mb': 3072,
            'cpu_load_pct': 14,
            'chrome_process_count': 7,
            'chrome_working_set_mb': 900,
            'startup_count': 6,
            'scheduled_task_count': 51,
            'suspicious_candidate_count': 0,
            'disks': [{'drive': 'C:', 'free_gb': 150.0}],
            'defender': {'status': 'AVAILABLE', 'realtime': True, 'detections_count': 0}
        },
        'process_groups': [
            {'name': 'Comet', 'working_set_mb': 1250.5},
            {'name': 'Discord', 'working_set_mb': 312.2},
            {'name': 'ms-teams', 'working_set_mb': 180.0}
        ],
        'privileged_secrets': {
            'path': r'C:\Users\Test User\Documents\secret.docx',
            'token': 'sk-THIS_IS_SYNTHETIC_AND_MUST_NOT_LEAK',
            'windows_title': 'Private client document'
        },
    }


class FakeRunner:
    def __init__(self, root, data=None, stdout_override=None, status=0):
        self.root = root
        self.data = data or fixture()
        self.stdout_override = stdout_override
        self.status = status
        self.calls = []

    def __call__(self, argv, **kwargs):
        self.calls.append((argv, kwargs))
        name = 'audit-pc-' + self.data['audit_id'] + '.json'
        raw = json.dumps(self.data, ensure_ascii=False).encode('utf-8')
        (self.root / name).write_bytes(raw)
        sha = hashlib.sha256(raw).hexdigest()
        stdout = json.dumps({'status':'LOCAL_AUDIT_SAVED','file_name':name,'sha256':sha})
        if self.stdout_override is not None:
            stdout = self.stdout_override
        return subprocess.CompletedProcess(argv, self.status, stdout, '')


class MaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='imperion-pc5-review-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'private audits'
        self.script = HERE / 'pc5_audit.ps1'
        self.runner = FakeRunner(self.root)
        self.payload = {'mode':'audit_pc', 'audit_id':ID}

    def call(self, payload=None, **overrides):
        kwargs={'platform':'win32','runner':self.runner,'root':self.root,'script':self.script,
                'memory_reader':lambda:(4096,16384)}
        kwargs.update(overrides)
        return pc5.operate(self.payload if payload is None else payload, **kwargs)

    def test_01_command_accepted_and_fixed_script_only(self):
        v=self.call()
        self.assertEqual(v['status'],'DONE')
        self.assertEqual(v['mode'],'audit_pc')
        argv,opts=self.runner.calls[0]
        self.assertEqual(argv[:4],['powershell.exe','-NoProfile','-NonInteractive','-File'])
        self.assertEqual(argv[-2:],['-AuditId', ID])
        self.assertEqual(argv[4],str(self.script))
        self.assertFalse(opts['check'])
        self.assertEqual(opts['timeout'],60)
        self.assertEqual(v['summary']['chrome_process_count'],7)
        self.assertEqual(v['summary']['ram_available_mb'],3072)

    def test_02_unknown_and_injected_commands_rejected(self):
        for p in ({'mode':'shell','command':'whoami'},
                  {'mode':'audit_pc','audit_id':ID,'command':'powershell -enc foo'},
                  {'mode':'audit_pc','audit_id':ID+';Remove-Item'},
                  {'mode':'audit pc','audit_id':ID},
                  {'mode':'audit_pc','audit_id':'../windows'},
                  {'mode':'audit_pc','audit_id':ID, 'ownerApproved':True}):
            self.assertEqual(self.call(p)['status'],'BLOCKED')
        self.assertEqual(self.runner.calls,[])

    def test_03_owner_gate_fake_flags_do_not_authorize(self):
        v=self.call({'mode':'remediate_pc','dry_run':False,'action_ids':['startup.comet']})
        self.assertEqual(v['reason'],'OWNER_GO_AND_IMPLEMENTATION_REQUIRED')
        self.assertEqual(self.call({'mode':'remediate_pc','dry_run':True,
                                    'action_ids':['startup.comet'],'ownerGo':True})['status'],'BLOCKED')
        self.assertEqual(self.runner.calls,[])

    def test_04_dry_run_no_system_change(self):
        v=self.call({'mode':'remediate_pc','dry_run':True,'action_ids':['startup.comet']})
        self.assertEqual(v['status'],'DRY_RUN_ONLY')
        self.assertEqual(v['changes_applied'],0)
        self.assertFalse(self.root.exists())
        self.assertEqual(self.runner.calls,[])

    def test_05_protected_components_and_arbitrary_actions_denied(self):
        for action in ['kill.chrome','stop.python','remove.ollama',
                       'disable.defender','delete.user_data','disable.Agent5',
                       'schedule-delete','registry-edit']:
            v=self.call({'mode':'remediate_pc','dry_run':True,'action_ids':[action]})
            self.assertEqual(v['status'],'BLOCKED')
        self.assertEqual(self.runner.calls,[])

    def test_06_offline_or_non_windows_fails_closed(self):
        v=self.call(platform='linux')
        self.assertEqual(v['reason'],'WINDOWS_REQUIRED')
        self.assertEqual(self.runner.calls,[])
        self.assertEqual(self.call({'mode':'audit_pc','audit_id':ID},platform='unknown')['status'],'BLOCKED')

    def test_07_defender_unavailable_is_reported_not_silent_success(self):
        f=fixture();f['summary']['defender']={'status':'UNAVAILABLE','realtime':None,'detections_count':None}
        self.runner=FakeRunner(self.root,f)
        v=self.call()
        self.assertEqual(v['status'],'DONE')
        self.assertEqual(v['summary']['defender_status'],'UNAVAILABLE')
        self.assertIsNone(v['summary']['defender_detections'])

    def test_08_dedupe_replay_returns_original_and_no_second_execution(self):
        a=self.call();b=self.call()
        self.assertEqual(a['sha256'],b['sha256'])
        self.assertFalse(a['replay']);self.assertTrue(b['replay'])
        self.assertEqual(len(self.runner.calls),1)

    def test_09_tampered_result_is_detected(self):
        self.call()
        (self.root/('audit-pc-'+ID+'.json')).write_text('{}')
        v=self.call()
        self.assertEqual(v['reason'],'REPLAY_EVIDENCE_MISMATCH')
        self.assertEqual(len(self.runner.calls),1)

    def test_10_no_private_strings_in_cloud_readback(self):
        v=self.call()
        wire=json.dumps(v)
        for forbidden in ('secret.docx','sk-THIS','Client','Windows\\Users','window_title',
                          'privileged_secrets','process_commandline','Documents'):
            self.assertNotIn(forbidden,wire)
        self.assertTrue(v['no_public_process_paths'])

    def test_11_windows_unicode_space_root(self):
        self.root=Path(self.temp.name)/'Имя пользователя'/'private audits'
        self.runner=FakeRunner(self.root)
        v=self.call()
        self.assertEqual(v['status'],'DONE')
        self.assertEqual(self.runner.calls[0][0][-1],ID)
        self.assertTrue((self.root/('audit-pc-'+ID+'.json')).is_file())

    def test_12_evidence_file_sha_and_receipt_match(self):
        v=self.call();path=self.root/v['file_name']
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),v['sha256'])
        receipt=json.loads((self.root/(ID+'.receipt.json')).read_text())
        self.assertEqual(receipt['sha256'],v['sha256'])

    def test_13_manifest_has_rollback_and_no_execution(self):
        acts=list(pc5.ACTION_IDS)
        v=self.call({'mode':'remediate_pc','dry_run':True,'action_ids':acts})
        self.assertEqual(v['changes_applied'],0)
        self.assertTrue(all(a['rollback'] and a['requires_fresh_baseline'] for a in v['actions']))
        self.assertTrue(all(a['state']=='PROPOSED_NOT_EXECUTED' for a in v['actions']))

    def test_14_duplicate_action_rejected(self):
        p={'mode':'remediate_pc','dry_run':True,'action_ids':['startup.comet','startup.comet']}
        self.assertEqual(self.call(p)['status'],'BLOCKED')

    def test_15_invalid_summary_rejected(self):
        f=fixture();f['summary']['ram_available_mb']=999999
        self.runner=FakeRunner(self.root,f)
        self.assertEqual(self.call()['reason'],'RAM_METRICS_INCONSISTENT')

    def test_16_malformed_runner_response_or_failed_exit(self):
        self.runner=FakeRunner(self.root,stdout_override='not JSON')
        self.assertEqual(self.call()['status'],'BLOCKED')
        self.assertFalse((self.root/(ID+'.receipt.json')).exists())
        (self.root/('audit-pc-'+ID+'.json')).unlink()
        self.runner=FakeRunner(self.root,status=3)
        self.assertEqual(self.call()['reason'],'LOCAL_AUDIT_EXECUTION_FAILED')

    def test_17_symlink_root_rejected(self):
        outside=Path(self.temp.name)/'outside';outside.mkdir()
        path=Path(self.temp.name)/'link'
        path.symlink_to(outside, target_is_directory=True)
        self.root=path/'private'
        self.runner=FakeRunner(self.root)
        self.assertEqual(self.call()['reason'],'PRIVATE_FOLDER_REDIRECT_DENIED')

    def test_18_stale_lock_denied_without_cleanup(self):
        self.root.mkdir(parents=True)
        (self.root/(ID+'.lock')).write_text('other run')
        self.assertEqual(self.call()['reason'],'AUDIT_ALREADY_RUNNING_OR_STALE_LOCK')
        self.assertEqual(self.runner.calls,[])
        self.assertTrue((self.root/(ID+'.lock')).exists())

    def test_19_private_localappdata_required(self):
        with mock.patch.dict(os.environ,{},clear=True):
            self.assertEqual(self.call(root=None)['reason'],'WINDOWS_PRIVATE_ROOT_UNAVAILABLE')

    def test_20_browser_bridge_hook_routes_only_exact_modes(self):
        self.assertIsNone(hook.maybe_dispatch('status',{'mode':'audit_pc'}))
        self.assertIsNone(hook.maybe_dispatch('pc_operator',{'mode':'app_status','app':'chrome'}))
        self.assertIsNone(hook.maybe_dispatch('pc_operator',{'mode':'shell'}))
        with mock.patch.object(hook, 'operate', return_value={'status':'DRY_RUN_ONLY','changes_applied':0}) as preview:
            planned = hook.maybe_dispatch('pc_operator',
                {'mode':'remediate_pc','dry_run':True,'action_ids':['startup.comet']})
        self.assertEqual(planned['result']['status'], 'DRY_RUN_ONLY')
        self.assertEqual(planned['result']['changes_applied'], 0)
        preview.assert_called_once()
        self.assertIsNone(hook.maybe_dispatch('pc_operator',None))
        with mock.patch.object(hook,'operate',return_value={'status':'DONE'}) as fn:
            v=hook.maybe_dispatch('pc_operator',{'mode':'audit_pc','audit_id':ID})
        self.assertEqual(v['result']['status'],'DONE')
        fn.assert_called_once()

    def test_21_denied_exception_redacts_host_error(self):
        def sensitive_failure(*args,**kwargs):
            raise OSError('secret-vault-token customer-file.txt')
        self.runner=sensitive_failure
        v=self.call()
        self.assertEqual(v,{'status':'BLOCKED','reason':'AUDIT_RUNTIME_BLOCKED'})
        self.assertNotIn('secret',json.dumps(v))

    def test_22_file_existing_without_receipt_denied(self):
        self.root.mkdir(parents=True)
        (self.root/('audit-pc-'+ID+'.json')).write_text('{}')
        self.assertEqual(self.call()['reason'],'AUDIT_SNAPSHOT_WITHOUT_RECEIPT')
        self.assertEqual(self.runner.calls,[])

    def test_24_ram_pressure_blocks_before_collector_without_files(self):
        self.assertEqual(self.call(memory_reader=lambda:(500,16384))['reason'],
                         'AUDIT_LOW_MEMORY_NO_EXECUTION')
        self.assertEqual(self.runner.calls,[])
        self.assertFalse(self.root.exists())

    def test_25_ram_preflight_unavailable_fails_closed(self):
        self.assertEqual(self.call(memory_reader=lambda:(_ for _ in ()).throw(OSError('sensitive path')))['reason'],
                         'AUDIT_MEMORY_PREFLIGHT_UNAVAILABLE')
        self.assertEqual(self.call(memory_reader=lambda:(20000,16384))['reason'],
                         'AUDIT_MEMORY_PREFLIGHT_UNAVAILABLE')
        self.assertEqual(self.runner.calls,[])

    def test_27_adaptive_threshold_admits_1024_and_blocks_1023(self):
        denied = self.call(memory_reader=lambda:(1023,16384))
        self.assertEqual(denied['reason'],'AUDIT_LOW_MEMORY_NO_EXECUTION')
        self.assertEqual(denied['minimum_free_ram_mb'],1024)
        self.assertEqual(self.runner.calls,[])
        completed = self.call(memory_reader=lambda:(1024,16384))
        self.assertEqual(completed['status'],'DONE')
        self.assertEqual(len(self.runner.calls),1)

    def test_28_verified_evidence_replay_works_under_ram_pressure(self):
        original=self.call()
        low=self.call(memory_reader=lambda:(100,16384))
        self.assertEqual(original['status'],'DONE')
        self.assertEqual(low['status'],'DONE')
        self.assertEqual(low['sha256'],original['sha256'])
        self.assertTrue(low['replay'])
        self.assertEqual(len(self.runner.calls),1)

    def test_29_verified_baseline_preview_never_modifies_windows(self):
        capture = self.call()
        payload = {'mode':'remediate_pc', 'dry_run':True,
                   'action_ids':['startup.comet','startup.discord'],
                   'audit_id':ID}
        planned = self.call(payload, memory_reader=lambda:(0,16384))
        self.assertEqual(planned['status'], 'DRY_RUN_ONLY')
        self.assertEqual(planned['baseline_sha256'], capture['sha256'])
        self.assertTrue(planned['baseline_verified'])
        self.assertEqual(planned['actions'][0]['observed_process_working_set_mb'],1250.5)
        self.assertEqual(planned['actions'][1]['observed_process_working_set_mb'],312.2)
        self.assertIsNone(planned['actions'][0]['expected_released_ram_mb'])
        self.assertEqual(planned['changes_applied'],0)
        self.assertEqual(len(self.runner.calls),1)
        self.assertNotIn('secret.docx',json.dumps(planned))
        self.assertNotIn('sk-THIS',json.dumps(planned))

    def test_30_baseline_missing_fails_closed(self):
        planned = self.call({'mode':'remediate_pc','dry_run':True,
                             'action_ids':['startup.comet'],'audit_id':ID})
        self.assertEqual(planned['reason'],'BASELINE_RECEIPT_MISSING')
        self.assertEqual(self.runner.calls,[])

    def test_31_forged_baseline_and_invalid_fields_denied(self):
        self.call()
        ((self.root / (ID+'.receipt.json'))).write_text(
            json.dumps({'sha256':'0'*64,'file':'audit-pc-'+ID+'.json'}))
        value = self.call({'mode':'remediate_pc','dry_run':True,
                           'action_ids':['startup.comet'],'audit_id':ID})
        self.assertEqual(value['reason'],'BASELINE_HASH_MISMATCH')
        illegal = {'mode':'remediate_pc','dry_run':True,
                   'action_ids':['startup.comet'],'audit_id':'../bad'}
        self.assertEqual(self.call(illegal)['reason'],'INVALID_AUDIT_ID')
        self.assertEqual(len(self.runner.calls),1)

    def test_32_source_collector_records_private_evidence_no_msi_side_effect(self):
        text = (HERE/'pc5_audit.ps1').read_text(encoding='utf-8')
        self.assertIn('top_process_details=',text)
        self.assertIn('installed_applications=',text)
        self.assertIn('quick_scan_command_available=',text)
        self.assertIn('chrome_visible_windows=',text)
        self.assertNotIn('Get-CimInstance Win32_Product', text)
        self.assertNotIn('Get-WmiObject Win32_Product', text)
        self.assertNotIn('Invoke-MpScan',text)
        self.assertNotIn('Start-Process -FilePath',text)

    def test_26_audit_timeout_denied_with_no_private_error(self):
        def timed_out(argv, **kwargs):
            raise subprocess.TimeoutExpired(argv,kwargs['timeout'])
        self.runner=timed_out
        result=self.call()
        self.assertEqual(result['reason'],'AUDIT_TIMEOUT_NO_AUTO_RETRY')
        self.assertFalse((self.root/(ID+'.receipt.json')).exists())

    def test_23_no_external_connection_or_scheduled_task_created(self):
        with mock.patch.object(subprocess,'Popen',side_effect=AssertionError('external process')):
            v=self.call()
        self.assertEqual(v['status'],'DONE')
        self.assertNotIn('http',json.dumps(v))


if __name__ == '__main__':
    unittest.main(verbosity=2)
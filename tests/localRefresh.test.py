import importlib.util
import json
import pathlib
import tempfile
import unittest
import sys
sys.dont_write_bytecode = True
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT/'scripts/local-refresh'/filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
runner = load('runner', 'run.py')
installer = load('installer', 'install.py')

class LocalRefreshTests(unittest.TestCase):
    def pipeline(self, mode='changed', validate=False, fail=None):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        state = pathlib.Path(temporary.name)
        calls = []
        manifest = {'capturedAt':'old', 'asOf':'2026-10-23', 'coverage':{'covered':10081}, 'parts':[]}
        def execute(args, **kwargs):
            calls.append(args)
            if fail and args[:3] == ('npm','run',fail):
                raise RuntimeError('test failure')
            if args[:3] == ('gh','pr','list'):
                output = json.dumps([{'headRefName':runner.BRANCH_PREFIX+'pending','url':'https://example.com/pr'}]) if mode == 'pending' else '[]'
            elif args[:2] == ('git','clone'):
                checkout = pathlib.Path(args[-1])
                (checkout/'public/models').mkdir(parents=True)
                (checkout/'public/models/historical-snapshot.json').write_text(json.dumps(manifest))
                output = ''
            elif args[:3] == ('npm','run','refresh:risk-models'):
                updated = {**manifest, 'capturedAt':'new'}
                if mode == 'changed': updated['asOf'] = '2026-10-30'
                (kwargs['cwd']/'public/models/historical-snapshot.json').write_text(json.dumps(updated))
                output = ''
            elif args[:2] == ('python3','scripts/risk-model-report.py'):
                artifacts=kwargs['cwd']/'artifacts'
                (artifacts/'risk-model-report.md').write_text('## Data report\nAutomated screens only.\n')
                (artifacts/'risk-model-report.json').write_text('{"reportSchemaVersion":1}')
                output=''
            elif args[:3] == ('gh','pr','create'):
                output = 'https://example.com/new-pr'
            else: output = ''
            return type('Result', (), {'stdout':output})()
        with patch.object(runner.subprocess,'run',side_effect=execute), patch('builtins.print'):
            try: result = runner.run_job(state, validate)
            except RuntimeError: result = json.loads((state/'status.json').read_text())
        return result, calls

    def test_changed_data_creates_pr_after_checks(self):
        result, calls = self.pipeline()
        self.assertEqual(result['status'],'pr_created')
        push = next(i for i,args in enumerate(calls) if args[:2] == ('git','push'))
        for check in runner.CHECKS:
            self.assertLess(calls.index(('npm','run',check)),push)
        self.assertFalse(any('merge' in args for args in calls))
        self.assertTrue(pathlib.Path(result['report']).exists(), 'report survives disposable checkout cleanup')

    def test_failed_check_never_pushes(self):
        result,calls = self.pipeline(fail='test:history')
        self.assertEqual(result['status'],'failed')
        self.assertFalse(any(args[:2] == ('git','push') for args in calls))

    def test_unchanged_capture_time_does_not_create_pr(self):
        result,calls = self.pipeline(mode='unchanged')
        self.assertEqual(result['status'],'unchanged')
        self.assertFalse(any(args[:2] == ('git','push') for args in calls))

    def test_existing_pr_waits_for_approval(self):
        result,calls = self.pipeline(mode='pending')
        self.assertEqual(result['status'],'awaiting_approval')
        self.assertFalse(any(args[:2] == ('git','clone') for args in calls))

    def test_validation_runs_checks_without_push(self):
        result,calls = self.pipeline(mode='unchanged',validate=True)
        self.assertEqual(result['status'],'validated')
        self.assertIn(('npm','run','build:cloudflare'), calls)
        self.assertFalse(any(args[:2] == ('git','push') for args in calls))

    def test_calendar_configuration(self):
        config = installer.configuration(pathlib.Path('/tmp/runner.py'), pathlib.Path('/tmp/state'), '/usr/bin')
        self.assertEqual(config['StartCalendarInterval'],{'Weekday':6,'Hour':22,'Minute':0})
        self.assertNotIn('RunAtLoad',config)
        self.assertEqual(config['ProgramArguments'][:2],['/usr/bin/caffeinate','-i'])

if __name__ == '__main__': unittest.main()

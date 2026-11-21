"""NEXUS offline preflight-only integration tests using real Python virtualenvs."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent

class TestAuditOnly(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='nexus-auditonly-')
        self.root = Path(self.tmp.name)
        self.venv = self.root / 'venv'
        subprocess.run([sys.executable, '-m', 'venv', '--without-pip', str(self.venv)], check=True, capture_output=True)
        self.bin = self.venv / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
        self.site = next((self.venv / 'lib').glob('python*/site-packages'))
        (self.site / 'demo_lib-1.0.dist-info').mkdir()
        (self.site / 'demo_lib-1.0.dist-info' / 'METADATA').write_text('Name: demo-lib\nVersion: 1.0\n')
        (self.root / 'nexus_prestart.py').write_text((HERE / 'nexus_prestart.py').read_text())
        (self.root / 'requirements.txt').write_text('requests==2.32.3\n')
        (self.root / 'worker.py').write_text("from pathlib import Path\nPath('worker-ran').write_text('yes')\n")

    def tearDown(self):
        self.tmp.cleanup()

    def audit(self, worker='worker.py'):
        env = dict(os.environ, VIRTUAL_ENV=str(self.venv))
        return subprocess.run([str(self.bin), '-I', '-S', 'nexus_prestart.py', '--source', 'requirements.txt',
                               '--worker', worker, '--preflight-only'], cwd=self.root, env=env,
                              text=True, capture_output=True)

    def test_clean_preflight_does_not_run_worker(self):
        proc = self.audit()
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertEqual(json.loads(proc.stdout)['status'], 'PASS_SCOPED')
        self.assertFalse((self.root / 'worker-ran').exists())

    def test_malicious_hook_blocks_before_hook_and_worker_execution(self):
        marker = self.root / 'pth-executed'
        (self.site / 'af_runtime_diag.pth').write_text(
            'import pathlib; pathlib.Path(' + repr(str(marker)) + ').write_text("bad")\n'
        )
        proc = self.audit()
        self.assertEqual(proc.returncode, 2, proc.stdout + proc.stderr)
        self.assertEqual(json.loads(proc.stdout)['status'], 'FAIL')
        self.assertFalse(marker.exists())
        self.assertFalse((self.root / 'worker-ran').exists())

    def test_missing_worker_fails_closed(self):
        proc = self.audit(worker='missing.py')
        self.assertEqual(proc.returncode, 1, proc.stdout + proc.stderr)
        self.assertIn('WORKER_ENTRY_UNVERIFIED', proc.stdout)

if __name__ == '__main__':
    unittest.main(verbosity=2)

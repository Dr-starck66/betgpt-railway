"""Offline synthetic tests — no actual malicious package is installed or executed."""
import importlib.util
from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("nexus_prestart", HERE / "nexus_prestart.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class TestPrestart(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="nexus-prestart-test-")
        self.root = Path(self.temp.name)
        self.src = self.root / "requirements.txt"
        self.src.write_text("requests==2.32.3\n", encoding="utf-8")
        self.site = self.root / "site-packages"
        self.site.mkdir()
        (self.site / "pip-24.0.dist-info").mkdir()
        (self.site / "pip-24.0.dist-info" / "METADATA").write_text("Name: pip\nVersion: 24.0\n")

    def tearDown(self):
        self.temp.cleanup()

    def scan(self):
        return guard.scan(self.src, [self.site])

    def test_clean_scoped_pass(self):
        self.assertEqual(self.scan()["status"], "PASS_SCOPED")

    def test_both_compromised_pins(self):
        for version in ("1.26.1", "1.26.2"):
            self.assertEqual(guard.classify_requirement(f"agent-framework=={version}"), "COMPROMISED_DEPENDENCY")
            self.assertEqual(guard.classify_requirement(f"agent_framework=={version}"), "COMPROMISED_DEPENDENCY")

    def test_transitive_ranged_dependency_blocks(self):
        self.assertEqual(guard.classify_requirement("agent-framework>=1.26.0"), "UNRESOLVED_DEPENDENCY")
        self.src.write_text("agent-framework>=1.26.0\n")
        self.assertEqual(self.scan()["status"], "PARTIAL")

    def test_known_pth_ioc_fails(self):
        (self.site / "agent_framework_meta.pth").write_text("import agent_framework_meta\n")
        self.assertEqual(self.scan()["status"], "FAIL")

    def test_installed_dist_info_fails(self):
        meta = self.site / "agent_framework-1.26.2.dist-info"
        meta.mkdir()
        (meta / "METADATA").write_text("Name: agent-framework\nVersion: 1.26.2\n")
        self.assertIn("COMPROMISED_INSTALLED_PACKAGE", [x["code"] for x in self.scan()["findings"]])

    def test_unknown_pth_is_review_not_clean(self):
        (self.site / "vendor.pth").write_text("import vendor_runtime\n")
        self.assertEqual(self.scan()["status"], "PARTIAL")

    def test_pth_data_only_ok(self):
        (self.site / "data.pth").write_text("relative_package_path\n")
        self.assertEqual(self.scan()["status"], "PASS_SCOPED")

    def test_external_sitecustomize_blocks(self):
        (self.site / "sitecustomize.py").write_text("print('hello')\n")
        self.assertEqual(self.scan()["status"], "PARTIAL")

    def test_missing_manifest_blocks(self):
        self.src.unlink()
        self.assertEqual(self.scan()["status"], "PARTIAL")

    def test_empty_runtime_blocks(self):
        self.assertEqual(guard.scan(self.src, [self.root / "missing"])['status'], "PARTIAL")

    def test_unrelated_package_not_flagged(self):
        self.assertIsNone(guard.classify_requirement("agent-framework-core==1.26.2"))
        self.assertIsNone(guard.classify_requirement("# agent-framework==1.26.2"))

    def test_no_secrets_output(self):
        (self.root / ".env").write_text("GPU_WORKER_TOKEN=this-is-a-secret\n")
        self.assertNotIn("this-is-a-secret", json.dumps(self.scan()))

    def test_symlink_ioc_blocks(self):
        (self.site / "af_runtime_diag.pth").symlink_to(self.src)
        self.assertEqual(self.scan()["status"], "PARTIAL")

    def test_start_requires_isolated_no_site(self):
        cmd = [sys.executable, str(HERE / "nexus_prestart.py"), "--source", str(self.src)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(r.returncode, 1)
        self.assertIn("PYTHON_MUST_USE_-I_-S", r.stdout)

    def test_safe_python_does_not_execute_pth(self):
        # Real venv launch with a *harmless marker* in .pth; normal site initialization
        # would write the marker, while the -S guard must not execute it.
        env = self.root / "venv"
        subprocess.run([sys.executable, "-m", "venv", "--without-pip", str(env)], check=True)
        sp = next((env / "lib").glob("python*/site-packages"))
        (sp / "pip-24.0.dist-info").mkdir()
        (sp / "pip-24.0.dist-info" / "METADATA").write_text("Name: pip\nVersion: 24.0\n")
        fired = self.root / "hook-fired.txt"
        (sp / "demo_hook.pth").write_text(f"import pathlib; pathlib.Path({str(fired)!r}).write_text('executed')\n")
        worker = self.root / "worker.py"
        worker.write_text(f"from pathlib import Path\nPath({str(self.root / 'worker-started.txt')!r}).write_text('started')\n")
        script = self.root / "start-secure.sh"
        script.write_text((HERE / "start-secure.sh").read_text())
        (self.root / "nexus_prestart.py").write_text((HERE / "nexus_prestart.py").read_text())
        # venv python must be first in PATH, with VIRTUAL_ENV announced.
        e = dict(os.environ, PATH=str(env / "bin") + os.pathsep + os.environ.get("PATH", ""), VIRTUAL_ENV=str(env))
        r = subprocess.run(["sh", str(script)], capture_output=True, text=True, cwd=self.root, env=e)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertFalse(fired.exists(), "unexpected .pth execution during guard")
        self.assertFalse((self.root / "worker-started.txt").exists(), "worker started despite hook")
        self.assertIn("EXECUTABLE_PTH_REVIEW", r.stdout)

    def test_clean_real_venv_worker_starts(self):
        env = self.root / "venv"
        subprocess.run([sys.executable, "-m", "venv", "--without-pip", str(env)], check=True)
        sp = next((env / "lib").glob("python*/site-packages"))
        (sp / "pip-24.0.dist-info").mkdir()
        (sp / "pip-24.0.dist-info" / "METADATA").write_text("Name: pip\nVersion: 24.0\n")
        worker = self.root / "worker.py"
        worker.write_text(f"from pathlib import Path\nPath({str(self.root / 'worker-started.txt')!r}).write_text('started')\n")
        script = self.root / "start-secure.sh"
        script.write_text((HERE / "start-secure.sh").read_text())
        (self.root / "nexus_prestart.py").write_text((HERE / "nexus_prestart.py").read_text())
        e = dict(os.environ, PATH=str(env / "bin") + os.pathsep + os.environ.get("PATH", ""), VIRTUAL_ENV=str(env))
        r = subprocess.run(["sh", str(script)], capture_output=True, text=True, cwd=self.root, env=e)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual((self.root / "worker-started.txt").read_text(), "started")
        self.assertIn('PASS_SCOPED', r.stdout)

    def test_isolated_bootstrap_loads_inspected_site_packages_without_pth(self):
        env = self.root / 'venv'
        subprocess.run([sys.executable, '-m', 'venv', '--without-pip', str(env)], check=True)
        sp = next((env / 'lib').glob('python*/site-packages'))
        (sp / 'demo_lib.py').write_text('VALUE = 42\n')
        (sp / 'demo_lib-1.0.dist-info').mkdir()
        (sp / 'demo_lib-1.0.dist-info' / 'METADATA').write_text('Name: demo-lib\nVersion: 1.0\n')
        (self.root / 'worker.py').write_text("import demo_lib\nfrom pathlib import Path\nPath('worker-started.txt').write_text(str(demo_lib.VALUE))\n")
        (self.root / 'start-secure.sh').write_text((HERE / 'start-secure.sh').read_text())
        (self.root / 'nexus_prestart.py').write_text((HERE / 'nexus_prestart.py').read_text())
        e = dict(os.environ, PATH=str(env/'bin') + os.pathsep + os.environ.get('PATH', ''), VIRTUAL_ENV=str(env))
        r = subprocess.run(['sh', 'start-secure.sh'], capture_output=True, text=True, cwd=self.root, env=e)
        self.assertEqual(r.returncode, 0, r.stdout+r.stderr)
        self.assertEqual((self.root/'worker-started.txt').read_text(), '42')

    def test_environment_pythonpath_not_imported(self):
        env = self.root / 'venv'
        subprocess.run([sys.executable, '-m', 'venv', '--without-pip', str(env)], check=True)
        sp = next((env / 'lib').glob('python*/site-packages'))
        (sp / 'demo_lib-1.0.dist-info').mkdir()
        (sp / 'demo_lib-1.0.dist-info' / 'METADATA').write_text('Name: demo-lib\nVersion: 1.0\n')
        injection = self.root/'injection'
        injection.mkdir()
        (injection / 'sitecustomize.py').write_text("from pathlib import Path\nPath('malicious-path-executed.txt').write_text('bad')\n")
        (self.root/'worker.py').write_text("from pathlib import Path\nPath('worker-started.txt').write_text('started')\n")
        for name in ('start-secure.sh', 'nexus_prestart.py'):
            (self.root/name).write_text((HERE/name).read_text())
        e = dict(os.environ, PATH=str(env/'bin') + os.pathsep + os.environ.get('PATH', ''), VIRTUAL_ENV=str(env), PYTHONPATH=str(injection))
        r = subprocess.run(['sh','start-secure.sh'], capture_output=True, text=True, cwd=self.root, env=e)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertFalse((self.root/'malicious-path-executed.txt').exists())
        self.assertEqual((self.root/'worker-started.txt').read_text(),'started')


if __name__ == '__main__':
    unittest.main(verbosity=2)

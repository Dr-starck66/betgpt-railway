"""NEXUS / ASTRA Ω — fail-closed Python startup-hook preflight.

Invoke ONLY as: python -I -S nexus_prestart.py --source requirements.txt --worker worker.py
-I isolates user-site/PYTHONPATH injection; -S prevents site and .pth execution.
After PASS_SCOPED, third-party packages are resolved from inspected paths WITHOUT executing .pth hooks.
The guard itself performs no pip installs, network calls, subprocesses, or secret reads.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import runpy
import sys
import sysconfig

BAD_VERSIONS = frozenset({"1.26.1", "1.26.2"})
BAD_FILENAMES = frozenset({"agent_framework_meta.pth", "af_runtime_diag.pth", "af_runtime_diag.py"})
MAX_FILE_BYTES = 2_000_000
MAX_ENTRIES_PER_ROOT = 30_000
PACKAGE = re.compile(r"(?i)^agent[-_]framework(?![\w.-])(?:\[[^]]+\])?\s*(===|==|>=|<=|~=|>|<|=)?\s*([0-9]+\.[0-9]+\.[0-9]+)?")
PKG_METADATA = re.compile(r"(?i)^agent[-_]framework-.+\.dist-info$")


def classify_requirement(line: str) -> str | None:
    clean = line.split("#", 1)[0].strip().strip("'\"")
    m = PACKAGE.match(clean)
    if not m:
        if re.match(r"(?i)^(-r|--requirement|-c|--constraint)\b", clean):
            return "INCLUDED_REQUIREMENTS_NEED_REVIEW"
        return None
    op, ver = m.groups()
    if ver in BAD_VERSIONS:
        return "COMPROMISED_DEPENDENCY"
    if op not in ("==", "===", "=") or not ver:
        return "UNRESOLVED_DEPENDENCY"
    return None


def get_roots() -> list[Path]:
    """Discover candidate site directories without importing the site module."""
    venv = os.environ.get("VIRTUAL_ENV")
    exe_parent = Path(sys.executable).parent.parent
    prefix = Path(venv) if venv else exe_parent if (exe_parent / "pyvenv.cfg").exists() else Path(sys.prefix)
    result: set[Path] = set()
    for directory in (prefix / "lib", prefix / "lib64"):
        if directory.is_dir():
            for py in directory.glob("python*"):
                if py.is_dir():
                    for kind in ("site-packages", "dist-packages"):
                        candidate = py / kind
                        if candidate.is_dir():
                            result.add(candidate)
    win = prefix / "Lib" / "site-packages"
    if win.is_dir():
        result.add(win)
    if not venv and not (exe_parent / "pyvenv.cfg").exists():
        for kind in ("site-packages", "dist-packages"):
            try:
                candidate = Path(sysconfig.get_path("purelib" if kind == "site-packages" else "platlib"))
                if candidate.is_dir():
                    result.add(candidate)
            except (KeyError, ValueError, TypeError):
                pass
        for user_lib in (Path.home() / ".local" / "lib").glob("python*/site-packages"):
            if user_lib.is_dir():
                result.add(user_lib)
    return sorted(result, key=str)


def scan(source: Path, roots: list[Path]) -> dict:
    findings: list[dict] = []
    stats = {"runtime_roots": len(roots), "runtime_entries": 0, "metadata_checked": 0,
             "startup_files_checked": 0, "manifest_checked": 0}
    def record(code: str, severity: str, where: str) -> None:
        findings.append({"code": code, "severity": severity, "where": where})
    if not source.is_file() or source.is_symlink():
        record("SOURCE_MANIFEST_MISSING_OR_SYMLINK", "PARTIAL", source.name)
    else:
        try:
            if source.stat().st_size > MAX_FILE_BYTES:
                record("SOURCE_MANIFEST_OVERSIZED", "PARTIAL", source.name)
            else:
                txt = source.read_text(encoding="utf-8")
                stats["manifest_checked"] += 1
                for lineno, line in enumerate(txt.splitlines(), 1):
                    code = classify_requirement(line)
                    if code:
                        record(code, "FAIL" if code == "COMPROMISED_DEPENDENCY" else "PARTIAL", f"{source.name}:{lineno}")
        except (OSError, UnicodeError):
            record("SOURCE_MANIFEST_UNREADABLE", "PARTIAL", source.name)
    if os.environ.get("PYTHONHOME"):
        record("PYTHONHOME_OVERRIDE_REVIEW", "PARTIAL", "runtime")
    # A stale/forged VIRTUAL_ENV must not cause us to scan a different venv.
    venv = os.environ.get("VIRTUAL_ENV")
    if venv:
        exe_root = Path(sys.executable).absolute().parent.parent
        if exe_root != Path(venv).absolute():
            record("VIRTUAL_ENV_EXECUTABLE_MISMATCH", "PARTIAL", "runtime")
    if not roots:
        record("NO_SITE_PACKAGES_DISCOVERED", "PARTIAL", "runtime")
    for root in roots:
        if not root.is_dir() or root.is_symlink():
            record("RUNTIME_ROOT_MISSING_OR_SYMLINK", "PARTIAL", root.name)
            continue
        metadata_count = 0
        try:
            entries = sorted(root.iterdir(), key=lambda p: p.name)
            if len(entries) > MAX_ENTRIES_PER_ROOT:
                record("RUNTIME_ROOT_TOO_LARGE", "PARTIAL", root.name)
                continue
            stats["runtime_entries"] += len(entries)
            for path in entries:
                name = path.name
                if path.is_symlink():
                    if name.endswith(".pth") or name in BAD_FILENAMES or PKG_METADATA.fullmatch(name):
                        record("SUSPICIOUS_SYMLINK_NEEDS_REVIEW", "PARTIAL", name)
                    continue
                if name in BAD_FILENAMES:
                    record("KNOWN_MALWARE_ARTIFACT", "FAIL", name)
                if name in ("sitecustomize.py", "usercustomize.py"):
                    record("AUTOIMPORT_CUSTOMIZATION_NEEDS_REVIEW", "PARTIAL", name)
                if name.endswith(".pth") and path.is_file():
                    stats["startup_files_checked"] += 1
                    try:
                        if path.stat().st_size > MAX_FILE_BYTES:
                            record("STARTUP_HOOK_OVERSIZED", "PARTIAL", name)
                        elif any(re.match(r"^\s*import(?:\s|\()", line) for line in path.read_text(encoding="utf-8").splitlines()):
                            record("EXECUTABLE_PTH_REVIEW", "PARTIAL", name)
                    except (OSError, UnicodeError):
                        record("STARTUP_HOOK_UNREADABLE", "PARTIAL", name)
                if path.is_dir() and PKG_METADATA.fullmatch(name):
                    met = path / "METADATA"
                    if met.is_symlink() or not met.is_file():
                        record("INSTALLED_METADATA_UNVERIFIED", "PARTIAL", name)
                        continue
                    try:
                        if met.stat().st_size > MAX_FILE_BYTES:
                            record("INSTALLED_METADATA_OVERSIZED", "PARTIAL", name)
                            continue
                        content = met.read_text(encoding="utf-8")
                        stats["metadata_checked"] += 1
                        name_m = re.search(r"(?im)^Name:\s*(\S+)", content)
                        ver_m = re.search(r"(?im)^Version:\s*(\S+)", content)
                        if not name_m or name_m.group(1).replace("_", "-").lower() != "agent-framework":
                            record("INSTALLED_METADATA_UNVERIFIED", "PARTIAL", name)
                        elif not ver_m:
                            record("INSTALLED_VERSION_UNKNOWN", "PARTIAL", name)
                        elif ver_m.group(1) in BAD_VERSIONS:
                            record("COMPROMISED_INSTALLED_PACKAGE", "FAIL", name)
                    except (OSError, UnicodeError):
                        record("INSTALLED_METADATA_UNREADABLE", "PARTIAL", name)
                if path.is_dir() and name == "agent_framework_meta":
                    record("SUSPICIOUS_AGENT_FRAMEWORK_META_DIRECTORY", "FAIL", name)
                if name.endswith(".dist-info"):
                    metadata_count += 1
        except OSError:
            record("RUNTIME_ROOT_UNREADABLE", "PARTIAL", root.name)
        if not metadata_count:
            record("NO_RUNTIME_METADATA_EVIDENCE", "PARTIAL", root.name)
    verdict = "FAIL" if any(f["severity"] == "FAIL" for f in findings) else \
              "PARTIAL" if findings else "PASS_SCOPED"
    return {"schema": "nexus-python-prestart/1", "status": verdict, "stats": stats,
            "findings": findings,
            "limits": "KNOWN_IOCS_ONLY; INSTALLED_ROOTS; BUILD_PHASE_UNVERIFIED; NO_SECRETS_READ"}


def main(argv: list[str] | None = None) -> int:
    if not sys.flags.no_site or not sys.flags.isolated:
        print(json.dumps({"status": "PARTIAL", "reason": "PYTHON_MUST_USE_-I_-S"}), flush=True)
        return 1
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="requirements.txt")
    ap.add_argument("--worker", default="worker.py")
    ap.add_argument("--preflight-only", action="store_true",
                    help="audit the runtime without importing or starting worker.py")
    ns = ap.parse_args(argv)
    roots = get_roots()
    report = scan(Path(ns.source), roots)
    worker = Path(ns.worker)
    if (worker.is_absolute() or len(worker.parts) != 1 or worker.is_symlink()
            or not worker.is_file() or worker.stat().st_size == 0):
        report["findings"].append({"code": "WORKER_ENTRY_UNVERIFIED", "severity": "PARTIAL", "where": "worker"})
        if report["status"] != "FAIL":
            report["status"] = "PARTIAL"
    print(json.dumps(report, ensure_ascii=False, sort_keys=True), flush=True)
    if report["status"] != "PASS_SCOPED":
        return 2 if report["status"] == "FAIL" else 1

    if ns.preflight_only:
        return 0

    # Safety invariant: Python has *never* loaded site, and will not load it now.
    # Inspected third-party paths are appended directly; .pth, sitecustomize and
    # usercustomize are never interpreted by this process.
    sys.path[:0] = [str(Path.cwd())]
    for root in roots:
        sys.path.append(str(root))
    sys.argv = [str(worker)]
    runpy.run_path(str(worker), run_name="__main__")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

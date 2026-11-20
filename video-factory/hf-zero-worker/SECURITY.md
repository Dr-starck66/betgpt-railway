# NEXUS Ω / BETGPT — Python pre-start security gate

**Integration target:** Railway `BETGPT VIDEO FACTORY Ω` / `hf-zero-gpu-worker`; source root `video-factory/hf-zero-worker` (existing service, no new service).

## Startup contract

The service's current command (`python worker.py`) is unsafe against malicious `.pth` hooks in installed packages. Replace the **start command** with `sh start-secure.sh` only after this branch has been reviewed and merged into the service's deployed source. The shell execs:

```sh
python -I -S nexus_prestart.py --source requirements.txt --worker worker.py
```

This uses **one isolated Python process**: `-S` prevents the normal Python `site` initialization and the execution of `.pth` lines; `-I` ignores user-site packages and `PYTHONPATH`. The preflight uses only Python's standard library to inspect the requirements file and discovered installed package roots. A `PASS_SCOPED` decision is required before it explicitly adds the inspected site-package roots to `sys.path` and runs the existing `worker.py` via `runpy.run_path`. It never processes `.pth` entries, even after PASS.

If the preflight cannot inspect a root, sees a known compromised version (`agent-framework` 1.26.1/1.26.2), known suspicious artifact, executable `.pth` hook or unexpected startup customization, **no worker code runs**. Exit 0 = successful worker exit; exit 1 = uncertain/partial; exit 2 = recognized compromise. The gate reads no secret *values* and does not perform network requests. Output reports contain artifact names, codes and aggregate counts only.

## Tests (stdlib only)

```sh
cd video-factory/hf-zero-worker
python -m unittest -v test_nexus_prestart.py
python -I -S -m py_compile nexus_prestart.py
sh -n start-secure.sh
```

Tests use temporary virtual environments and synthetic `.pth` hooks; no actual malware is installed. In particular they check that a harmless `.pth` marker is NOT executed and the worker is NOT launched after a failed check, and that an installed package is importable in the isolated worker after a clean check.

## Limits and deployment evidence

- This is a **runtime pre-start guard**, not a build-time dependency lock or a complete software-supply-chain defense. Compromised dependencies can still execute code at **build time**. Install with trusted source and verified hashes, prohibit mutable dependency versions and use separate build-stage scans.
- An installed module can still contain malicious code even if its version and `.pth` artifacts look normal. A `PASS_SCOPED` verdict is not a guarantee of safety or a certificate of supply-chain provenance.
- The current rule set is incident-specific and needs ongoing updates; symlinked package content and extension modules are not exhaustively scanned.
- An offline service has no live startup proof. GitHub PRs, local integration tests, and a staged Railway start command are **not deployment proofs**.
- Fail closed may prevent startup if vendor tooling uses executable `.pth` hooks, or if platform Python paths do not match the discovered environment. Investigate the logged `PARTIAL` reason instead of bypassing the guard.
- Never dump `.env`, token values or raw credentials in logs. If a compromised release was installed previously, rotate potentially exposed tokens and rebuild the environment from a trusted base before redeployment.

## Contrôle négatif conservé (ChatGPT sandbox, 20 Nov 2026)

Une analyse directe d’un environnement Python préexistant (et **non** du service Railway) a trouvé 5 hooks `.pth` exécutables et rendu `PARTIAL`, code 1, avant toute importation tierce. Trois noms distincts observés : `000_oai_py_sys_path_prepend.pth`, `a1_coverage.pth`, `distutils-precedence.pth` (les deux derniers apparaissent dans deux racines). Ces marqueurs ne démontrent pas une infection, et le garde n’en exécute aucun. Ils prouvent qu’un environnement légitime peut avoir besoin d’une politique d’examen des hooks documentée, faute de quoi le fail-closed empêchera de démarrer. **Aucun contournement automatique ni mise en service n’a été ajouté.**
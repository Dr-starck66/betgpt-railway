# ASTRA CLOUD EGRESS Ω

Reusable remote-network verification brick.

## Purpose

Production verification must not depend on the DNS, outbound network, ports, callbacks, or resolver available inside the current assistant/runtime sandbox.

A local network failure is treated as a routing signal, not as proof that the public service is unavailable.

## Verification order

1. Provider/API state when available.
2. Independent cloud-runner HTTP/DNS probes through **ASTRA CLOUD EGRESS Ω**.
3. Public-domain probe.
4. Provider-origin fallback probe.
5. Browser/web verification when useful for rendered UX.

The final status is evidence-based:

- **PASS**: the primary public target passes DNS plus every required probe.
- **PARTIAL**: public target fails but a declared provider fallback passes.
- **FAIL**: no declared target passes.
- **UNVERIFIED**: only when no remote verification channel can be executed.

## Reuse

Copy these three files to another site:

- `scripts/astra-cloud-egress.mjs`
- `config/astra-cloud-egress.json`
- `.github/workflows/astra-cloud-egress.yml`

Then change only `targets` and `probes`.

The runner supports:

- several domains/origins ordered by priority;
- fallback targets;
- cloud DNS A/AAAA evidence;
- GET/POST and JSON request bodies;
- expected HTTP status codes;
- required/forbidden response text;
- JSON path + text assertions;
- retries and timeouts;
- final evidence JSON + Markdown artifact.

## Zero-local-DNS policy

For production websites, APIs, deployment callbacks and health checks, do not stop because the local runtime cannot resolve a host. Automatically route verification to a connected provider/API or this cloud-runner workflow. Do not ask the user to run curl/nslookup manually when a remote channel is available.

Local DNS results may be retained as diagnostic metadata, but they are never the sole production verdict.

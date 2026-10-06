import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const SITE = "https://betgpt.live";
const OUT = path.resolve("data/authority");
const RUN_AT = new Date().toISOString();
const ZENODO_TOKEN = String(process.env.ZENODO_TOKEN || "").trim();

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "ASTRA-AUTHORITY-CITATION-ENGINE/1.0 (+https://betgpt.live/press)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.text();
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function normalizeRadar(items) {
  const seen = new Set();
  return items
    .map((x) => ({
      title: String(x.title || "").trim(),
      url: String(x.url || "").trim(),
      domain: domainOf(x.url),
      seenAt: String(x.seendate || x.date || RUN_AT),
      language: String(x.language || ""),
      sourceCountry: String(x.sourcecountry || ""),
    }))
    .filter((x) => x.title && /^https?:\/\//.test(x.url))
    .filter((x) => {
      const key = x.url.replace(/[?#].*$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((x) => !/(betgpt\.live|pinterest\.|facebook\.|instagram\.|tiktok\.)/i.test(x.url))
    .slice(0, 80);
}

async function gdeltRadar() {
  const queries = [
    '("pronostics sportifs" OR "pronostics football" OR "site de pronostics")',
    '("football prediction" OR "sports betting prediction") AND (AI OR model OR data)',
  ];
  const all = [];
  for (const query of queries) {
    const u = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    u.searchParams.set("query", query);
    u.searchParams.set("mode", "artlist");
    u.searchParams.set("maxrecords", "50");
    u.searchParams.set("timespan", "7d");
    u.searchParams.set("sort", "datedesc");
    u.searchParams.set("format", "json");
    try {
      const raw = await fetchText(u.toString());
      const data = JSON.parse(raw);
      const rows = Array.isArray(data.articles) ? data.articles : Array.isArray(data.items) ? data.items : [];
      all.push(...rows);
    } catch (error) {
      console.warn("ASTRA_AUTHORITY_RADAR_SOURCE_PARTIAL", query, String(error));
    }
  }
  return normalizeRadar(all);
}

function buildReadme(summary, hashes) {
  return `# BetGPT public prediction evidence pack

Generated: ${RUN_AT}

Canonical site: ${SITE}

This package mirrors BetGPT's public evidence surfaces so journalists, analysts and independent reviewers can audit the same material without relying on marketing claims.

## Files

- \`evidence.json\` — machine-readable public prediction register
- \`evidence.csv\` — CSV export of the public register
- \`citation.json\` — canonical citation metadata and proof URLs
- \`radar.json\` — recent editorial opportunities discovered from public news coverage

## Snapshot

- Public register rows: ${summary.count}
- JSON SHA-256: \`${hashes.json}\`
- CSV SHA-256: \`${hashes.csv}\`

## Citation

Preferred short citation:

> BetGPT (betgpt.live), public football prediction register.

Use the methodology and ledger before quoting performance metrics. BetGPT does not claim to be a bookmaker and does not guarantee profit.

## Verification

Methodology: ${SITE}/methodology  
Ledger: ${SITE}/ledger  
Prediction history: ${SITE}/prediction-history  
Precision report: ${SITE}/rapports/precision  
Evidence JSON: ${SITE}/evidence.json  
Evidence CSV: ${SITE}/evidence.csv
`;
}

async function zenodoPublish(files, citation) {
  if (!ZENODO_TOKEN) {
    console.log("ASTRA_AUTHORITY_ZENODO_SKIPPED missing=ZENODO_TOKEN");
    return { status: "SKIPPED_NO_TOKEN" };
  }
  const headers = {
    authorization: `Bearer ${ZENODO_TOKEN}`,
    "content-type": "application/json",
  };
  const create = await fetch("https://zenodo.org/api/deposit/depositions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      metadata: {
        title: "BetGPT Public Football Prediction Evidence Dataset",
        upload_type: "dataset",
        description:
          "Public snapshot of BetGPT football predictions and audit metadata. Includes timestamped evidence exports and links to the public methodology, ledger and prediction history.",
        creators: [{ name: "BetGPT", affiliation: "betgpt.live" }],
        keywords: ["football", "sports predictions", "probability", "Brier score", "prediction audit"],
        related_identifiers: [{ identifier: SITE, relation: "isSupplementTo", scheme: "url" }],
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (create.status !== 201) throw new Error(`ZENODO_CREATE_${create.status}: ${await create.text()}`);
  const dep = await create.json();
  for (const file of files) {
    const body = new FormData();
    body.set("name", path.basename(file));
    body.set("file", new Blob([await fs.readFile(file)]), path.basename(file));
    const upload = await fetch(`https://zenodo.org/api/deposit/depositions/${dep.id}/files`, {
      method: "POST",
      headers: { authorization: `Bearer ${ZENODO_TOKEN}` },
      body,
      signal: AbortSignal.timeout(60000),
    });
    if (upload.status !== 201) throw new Error(`ZENODO_UPLOAD_${upload.status}: ${await upload.text()}`);
  }
  const publish = await fetch(`https://zenodo.org/api/deposit/depositions/${dep.id}/actions/publish`, {
    method: "POST",
    headers: { authorization: `Bearer ${ZENODO_TOKEN}` },
    signal: AbortSignal.timeout(30000),
  });
  if (publish.status !== 202) throw new Error(`ZENODO_PUBLISH_${publish.status}: ${await publish.text()}`);
  const published = await publish.json();
  citation.zenodo = {
    doi: published.doi || null,
    doiUrl: published.doi_url || null,
    recordId: published.record_id || null,
  };
  console.log("ASTRA_AUTHORITY_ZENODO_PASS", JSON.stringify(citation.zenodo));
  return { status: "PUBLISHED", ...citation.zenodo };
}

await fs.mkdir(OUT, { recursive: true });

const [jsonRaw, csvRaw, radar] = await Promise.all([
  fetchText(`${SITE}/evidence.json`),
  fetchText(`${SITE}/evidence.csv`),
  gdeltRadar(),
]);

const evidence = JSON.parse(jsonRaw);
const count = Number(evidence.count ?? (Array.isArray(evidence.items) ? evidence.items.length : 0));
const hashes = { json: sha256(jsonRaw), csv: sha256(csvRaw) };
const summary = { count, generatedAt: RUN_AT };

const citation = {
  schema: "astra-authority-citation/v1",
  name: "BetGPT",
  canonicalUrl: SITE,
  description: "Plateforme française d’analyse football et de pronostics sportifs assistés par modèle.",
  generatedAt: RUN_AT,
  preferredCitation: "BetGPT (betgpt.live), public football prediction register.",
  proof: {
    methodology: `${SITE}/methodology`,
    dataSources: `${SITE}/data-sources`,
    ledger: `${SITE}/ledger`,
    predictionHistory: `${SITE}/prediction-history`,
    precisionReport: `${SITE}/rapports/precision`,
    evidenceJson: `${SITE}/evidence.json`,
    evidenceCsv: `${SITE}/evidence.csv`,
  },
  hashes,
  rows: count,
  caveat:
    "Performance figures must be quoted with sample size, market definition and methodology. Historical simulations are not realized profits.",
};

const files = {
  evidenceJson: path.join(OUT, "evidence.json"),
  evidenceCsv: path.join(OUT, "evidence.csv"),
  citation: path.join(OUT, "citation.json"),
  radar: path.join(OUT, "radar.json"),
  readme: path.join(OUT, "README.md"),
  hfReadme: path.join(OUT, "HUGGINGFACE_README.md"),
  zenodoMeta: path.join(OUT, "zenodo-metadata.json"),
  outreachQueue: path.join(OUT, "outreach-queue.json"),
};

const outreach = radar.slice(0, 30).map((x) => ({
  ...x,
  status: "REVIEW",
  fitReason:
    "Article récent lié aux pronostics, à la prédiction football ou aux modèles de données. Vérifier l’auteur et l’angle avant tout contact.",
  suggestedAsset: `${SITE}/press`,
  prohibited: ["paid-placement", "fake-review", "bulk-spam"],
}));

await Promise.all([
  fs.writeFile(files.evidenceJson, JSON.stringify(evidence, null, 2) + "\n"),
  fs.writeFile(files.evidenceCsv, csvRaw.endsWith("\n") ? csvRaw : csvRaw + "\n"),
  fs.writeFile(files.citation, JSON.stringify(citation, null, 2) + "\n"),
  fs.writeFile(files.radar, JSON.stringify({ generatedAt: RUN_AT, items: radar }, null, 2) + "\n"),
  fs.writeFile(files.readme, buildReadme(summary, hashes)),
  fs.writeFile(
    files.hfReadme,
    `---\npretty_name: BetGPT Public Football Prediction Evidence\nlanguage:\n- fr\ntags:\n- football\n- sports\n- predictions\n- probability\n---\n\n# BetGPT Public Football Prediction Evidence\n\nCanonical source: ${SITE}/ledger\n\nThis dataset mirror contains the public BetGPT prediction evidence export. Use ${SITE}/methodology and ${SITE}/prediction-history to interpret the fields. Losses remain visible; missing values are not fabricated.\n\nPreferred citation: **BetGPT (betgpt.live), public football prediction register.**\n`,
  ),
  fs.writeFile(
    files.zenodoMeta,
    JSON.stringify(
      {
        title: "BetGPT Public Football Prediction Evidence Dataset",
        upload_type: "dataset",
        description:
          "Public snapshot of BetGPT football predictions and audit metadata, with timestamped evidence exports and links to methodology and ledger.",
        creators: [{ name: "BetGPT", affiliation: "betgpt.live" }],
        keywords: ["football", "sports predictions", "probability", "prediction audit"],
      },
      null,
      2,
    ) + "\n",
  ),
  fs.writeFile(files.outreachQueue, JSON.stringify({ generatedAt: RUN_AT, items: outreach }, null, 2) + "\n"),
]);

if (process.argv.includes("--zenodo")) {
  await zenodoPublish([files.evidenceJson, files.evidenceCsv, files.citation, files.readme], citation);
  await fs.writeFile(files.citation, JSON.stringify(citation, null, 2) + "\n");
}

console.log(
  "ASTRA_AUTHORITY_CITATION_ENGINE_PASS",
  JSON.stringify({ generatedAt: RUN_AT, rows: count, radar: radar.length, hashes }),
);

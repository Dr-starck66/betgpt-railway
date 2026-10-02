import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const OUTPUT_DIR = path.join(DATA_DIR, "outputs");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const WORKER_TOKEN = process.env.GPU_WORKER_TOKEN || "";
const API_KEY = process.env.VIDEO_FACTORY_API_KEY || "";
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 600 * 1024 * 1024);
const ROBOT_REFERENCE_URL = process.env.BETGPT_ROBOT_REFERENCE_URL || "https://astra-voice-mobile.floot.app/_cdn/static/74a2d252-cf98-49ad-92e1-9f8bb4f4f3d3-betgpt-robot-reference.png";

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const providers = [
  { id: "wan22", label: "Wan 2.2 TI2V-5B", env: "WAN22_WORKER_URL", mode: "push" },
  { id: "skyreels-v3", label: "SkyReels V3", env: "SKYREELS_WORKER_URL", mode: "push" },
  { id: "ltx2", label: "LTX-2", env: "LTX2_WORKER_URL", mode: "push" },
];

const cameraBeats = [
  "Cinematic establishing shot, floodlit football stadium at night, premium sports advertising photography, slow crane movement",
  "Dynamic tracking shot toward the BetGPT robot mascot, confident hero framing, shallow depth of field, realistic reflections",
  "Fast orbital camera move around the subject, energetic match-day atmosphere, holographic football-data ambience without readable text",
  "Intense close-up reaction shot, dramatic stadium lights, crisp commercial detail, controlled motion blur",
  "Wide crowd-energy shot transitioning back to the mascot, polished brand-film composition, premium broadcast look",
  "Final hero shot, mascot centered, stadium lights bloom behind it, clean space reserved for a later BetGPT call-to-action overlay",
];

function now() {
  return new Date().toISOString();
}

function loadJobs() {
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, "utf8"));
  } catch {
    return [];
  }
}

let jobs = loadJobs();

function saveJobs() {
  const tmp = JOBS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(jobs.slice(-300), null, 2));
  fs.renameSync(tmp, JOBS_FILE);
}

function publicJob(job) {
  const { workerToken, ...safe } = job;
  return safe;
}

function buildShots(prompt, duration) {
  const shotLength = 4;
  const count = Math.max(1, Math.min(8, Math.ceil(duration / shotLength)));
  return Array.from({ length: count }, (_, index) => ({
    index,
    duration: Math.min(shotLength, Math.max(1, duration - index * shotLength)),
    prompt:
      `${prompt}. ${cameraBeats[index % cameraBeats.length]}. Preserve the exact same BetGPT robot identity from the supplied reference image: same face, proportions, white and graphite armor and emerald luminous accents. Premium cinematic sports advertising film, physically plausible motion, stable anatomy, crisp materials, realistic reflections, controlled camera motion, no redesign, no morphing, no extra limbs, no watermarks, no captions, no malformed text.`,
  }));
}

function configuredProviders() {
  const configured = providers.map((p) => ({
    id: p.id,
    label: p.label,
    configured: Boolean(process.env[p.env]),
    mode: p.mode,
  }));
  configured.push({
    id: "ltx-zero",
    label: "LTX Video ZeroGPU · gratuit",
    configured: Boolean(WORKER_TOKEN),
    mode: "pull",
  });
  return configured;
}

function selectProvider(model) {
  if (model && model !== "auto") {
    const p = providers.find((x) => x.id === model);
    if (p && process.env[p.env]) return p;
  }
  return providers.find((p) => process.env[p.env]) || null;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendHtml(res, html) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(html);
}

function unauthorized(res) {
  sendJson(res, 401, { error: "unauthorized" });
}

function checkApiAuth(req) {
  if (!API_KEY) return true;
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  return bearer === API_KEY || req.headers["x-api-key"] === API_KEY;
}

function checkWorkerAuth(req) {
  if (!WORKER_TOKEN) return false;
  return req.headers["x-worker-token"] === WORKER_TOKEN;
}

async function readJson(req, limit = 2 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("payload_too_large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  return `${proto}://${req.headers.host}`;
}

async function dispatchPush(job, req) {
  const provider = selectProvider(job.model);
  if (!provider) return false;
  const workerUrl = process.env[provider.env].replace(/\/$/, "");
  job.provider = provider.id;
  job.status = "DISPATCHING";
  job.updated_at = now();
  saveJobs();

  try {
    const response = await fetch(workerUrl + "/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(WORKER_TOKEN ? { "x-worker-token": WORKER_TOKEN } : {}),
      },
      body: JSON.stringify({
        job_id: job.id,
        prompt: job.prompt,
        duration: job.duration,
        aspect_ratio: job.aspect_ratio,
        shots: job.shots,
        reference_images: job.reference_images,
        seed: job.seed,
        callback_url: baseUrl(req) + "/api/callback/" + job.id,
        callback_secret: process.env.CALLBACK_SECRET || "",
      }),
      signal: AbortSignal.timeout(20000),
    });

    const body = await response.text();
    if (!response.ok) throw new Error(`worker_http_${response.status}: ${body.slice(0, 300)}`);
    let parsed = {};
    try { parsed = JSON.parse(body); } catch {}
    job.status = parsed.status || "QUEUED_GPU";
    job.external_job_id = parsed.external_job_id || null;
    job.updated_at = now();
    saveJobs();
    return true;
  } catch (error) {
    job.status = "QUEUED_GPU";
    job.last_error = String(error?.message || error);
    job.updated_at = now();
    saveJobs();
    return false;
  }
}

function createJob(input) {
  const prompt = String(input.prompt || "").trim();
  if (prompt.length < 12) throw new Error("prompt_too_short");
  const duration = Math.max(5, Math.min(30, Number(input.duration || 15)));
  const aspect = ["9:16", "16:9", "1:1"].includes(input.aspect_ratio) ? input.aspect_ratio : "9:16";
  const model = ["auto", ...providers.map((p) => p.id)].includes(input.model) ? input.model : "auto";
  const referenceImages = Array.isArray(input.reference_images)
    ? input.reference_images.map(String).filter(Boolean).slice(0, 4)
    : [];
  const job = {
    id: randomUUID(),
    prompt,
    duration,
    aspect_ratio: aspect,
    model,
    provider: null,
    reference_images: referenceImages,
    seed: Number.isFinite(Number(input.seed)) ? Number(input.seed) : Math.floor(Math.random() * 2_000_000_000),
    shots: buildShots(prompt, duration),
    status: "QUEUED_GPU",
    progress: 0,
    video_url: null,
    last_error: null,
    created_at: now(),
    updated_at: now(),
  };
  jobs.push(job);
  saveJobs();
  return job;
}

function findJob(id) {
  return jobs.find((j) => j.id === id);
}

function serveVideo(req, res, filePath) {
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {
      "content-type": "video/mp4",
      "content-length": stat.size,
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=31536000, immutable",
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) {
    res.writeHead(416);
    res.end();
    return;
  }
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
  if (start > end || start >= stat.size) {
    res.writeHead(416, { "content-range": `bytes */${stat.size}` });
    res.end();
    return;
  }
  res.writeHead(206, {
    "content-type": "video/mp4",
    "content-length": end - start + 1,
    "content-range": `bytes ${start}-${end}/${stat.size}`,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
  });
  fs.createReadStream(filePath, { start, end }).pipe(res);
}

const html = String.raw`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>BetGPT Video Factory Ω</title>
<style>
:root{color-scheme:dark;--bg:#06080d;--card:#0f1420;--muted:#8993a5;--line:#222c3b;--accent:#52f28f;--accent2:#7aa7ff}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:radial-gradient(circle at 10% 0,#172036 0,transparent 35%),var(--bg);color:#f7f9fc;min-height:100vh}
.wrap{max-width:1180px;margin:auto;padding:28px 18px 70px}.top{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:22px}.brand{display:flex;gap:14px;align-items:center}.orb{width:50px;height:50px;border-radius:18px;background:linear-gradient(145deg,var(--accent),var(--accent2));box-shadow:0 0 50px #52f28f33}.eyebrow{font-size:12px;letter-spacing:.16em;color:var(--accent);font-weight:800}.title{font-size:clamp(26px,5vw,46px);font-weight:900;letter-spacing:-.04em;margin:2px 0}.sub{color:var(--muted);max-width:760px;line-height:1.5}.grid{display:grid;grid-template-columns:1.05fr .95fr;gap:18px}@media(max-width:850px){.grid{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}}
.card{background:linear-gradient(180deg,#111725dd,#0b0f18ee);border:1px solid var(--line);border-radius:22px;padding:20px;box-shadow:0 18px 60px #0006}.card h2{font-size:17px;margin:0 0 16px}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}@media(max-width:560px){.row,.row3{grid-template-columns:1fr}}
label{display:block;font-size:12px;font-weight:700;color:#aeb7c6;margin:12px 0 7px}textarea,input,select{width:100%;border:1px solid #2b3547;background:#080c13;color:white;border-radius:13px;padding:12px 13px;outline:none}textarea{min-height:150px;resize:vertical}textarea:focus,input:focus,select:focus{border-color:var(--accent2)}
button{width:100%;margin-top:16px;border:0;border-radius:14px;padding:14px 16px;font-weight:900;font-size:15px;cursor:pointer;background:linear-gradient(90deg,var(--accent),#7df4ff);color:#03120a;box-shadow:0 10px 30px #52f28f28}button:disabled{opacity:.5;cursor:not-allowed}.models{display:grid;gap:9px}.model{display:flex;justify-content:space-between;align-items:center;border:1px solid var(--line);border-radius:13px;padding:11px 12px;background:#090d15}.dot{width:9px;height:9px;border-radius:50%;background:#ffb84d}.dot.on{background:var(--accent);box-shadow:0 0 15px #52f28f}
.mascot{display:flex;gap:12px;align-items:center;margin:0 0 14px;padding:10px;border:1px solid var(--line);border-radius:15px;background:#080c13}.mascot img{width:78px;height:78px;object-fit:cover;border-radius:13px}.mascot b{display:block;font-size:13px}.mascot span{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:4px}.status{margin-top:15px;padding:12px;border-radius:13px;background:#080c13;border:1px solid var(--line);color:#cbd3df;font-size:13px;white-space:pre-wrap}.jobs{margin-top:18px;display:grid;gap:10px}.job{border:1px solid var(--line);border-radius:15px;padding:13px;background:#090d15}.jobhead{display:flex;justify-content:space-between;gap:10px;font-size:12px}.pill{padding:4px 8px;border-radius:999px;background:#182235;color:#a7c6ff;font-weight:800}.job p{color:#aeb7c6;font-size:13px;line-height:1.45;margin:9px 0}.job video{width:100%;border-radius:12px;background:#000;margin-top:10px}.tiny{font-size:11px;color:#748095}.progress{height:5px;background:#192130;border-radius:99px;overflow:hidden;margin-top:8px}.progress>i{display:block;height:100%;background:linear-gradient(90deg,var(--accent2),var(--accent));width:0}
</style>
</head>
<body><main class="wrap">
<div class="top"><div class="brand"><div class="orb"></div><div><div class="eyebrow">BETGPT CREATIVE CLOUD</div><div class="title">Video Factory Ω</div></div></div><div class="sub">Génération de vraies séquences vidéo IA avec routage vers Wan 2.2, SkyReels V3 ou LTX-2. Railway orchestre les jobs; les GPU externes font l'inférence.</div></div>
<div class="grid">
<section class="card">
<h2>Créer une publicité BetGPT</h2>
<div class="mascot"><img src="https://astra-voice-mobile.floot.app/_cdn/static/74a2d252-cf98-49ad-92e1-9f8bb4f4f3d3-betgpt-robot-reference.png" alt="Mascotte BetGPT de référence"><div><b>Mascotte BetGPT verrouillée</b><span>Injectée automatiquement dans chaque génération pour conserver le même robot.</span></div></div>
<label>Concept / prompt</label>
<textarea id="prompt">A premium BetGPT advertising film. A small futuristic BetGPT robot mascot enters a packed football stadium at night, analyzes the match with glowing holographic data, then turns toward the camera with a confident playful attitude. Ultra realistic materials, cinematic lighting, energetic sports-commercial pacing.</textarea>
<div class="row3">
<div><label>Durée</label><select id="duration"><option>5</option><option>10</option><option selected>15</option><option>20</option><option>30</option></select></div>
<div><label>Format</label><select id="aspect"><option selected>9:16</option><option>16:9</option><option>1:1</option></select></div>
<div><label>Modèle</label><select id="model"><option value="auto">AUTO</option><option value="wan22">Wan 2.2</option><option value="skyreels-v3">SkyReels V3</option><option value="ltx2">LTX-2</option></select></div>
</div>
<label>Références supplémentaires (optionnel)</label>
<input id="refs" placeholder="Produit, décor, stade… La mascotte BetGPT est déjà fournie automatiquement." />
<button id="go">GÉNÉRER LA PUB</button>
<div class="status" id="status">Prêt.</div>
</section>
<section class="card">
<h2>GPU Router Ω</h2>
<div id="models" class="models"></div>
<div class="status" id="router">Détection des workers GPU…</div>
<h2 style="margin-top:22px">Jobs récents</h2>
<div id="jobs" class="jobs"></div>
</section>
</div>
</main>
<script>
const q=(s)=>document.querySelector(s);
let apiKey=localStorage.getItem("betgptVideoApiKey")||"";
const headers=()=>({"content-type":"application/json",...(apiKey?{"x-api-key":apiKey}:{})});
async function api(url,opts={}){const r=await fetch(url,{...opts,headers:{...headers(),...(opts.headers||{})}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||("HTTP "+r.status));return j}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
async function refresh(){
  try{
    const c=await api("/api/capabilities");
    q("#models").innerHTML=c.providers.map(p=>'<div class="model"><b>'+esc(p.label)+'</b><span><span class="dot '+(p.configured?"on":"")+'"></span> '+(p.configured?"connecté":"en attente")+'</span></div>').join("");
    q("#router").textContent=c.pull_worker_enabled?"Worker pull sécurisé actif : un GPU Kaggle/Colab peut réclamer les jobs.":"Worker GPU non appairé. Le studio accepte les jobs mais ne les déclarera jamais terminés sans vraie sortie vidéo.";
    const data=await api("/api/jobs");
    q("#jobs").innerHTML=data.jobs.slice(0,8).map(j=>{
      const pct=Number(j.progress||0);
      return '<div class="job"><div class="jobhead"><span class="pill">'+esc(j.status)+'</span><span>'+new Date(j.created_at).toLocaleString()+'</span></div><p>'+esc(j.prompt).slice(0,180)+'</p><div class="tiny">'+esc(j.provider||j.model)+' · '+j.duration+'s · '+esc(j.aspect_ratio)+'</div><div class="progress"><i style="width:'+pct+'%"></i></div>'+(j.video_url?'<video controls playsinline src="'+esc(j.video_url)+'"></video>':'')+(j.last_error?'<div class="tiny" style="margin-top:8px">Erreur: '+esc(j.last_error)+'</div>':'')+'</div>'
    }).join("")||'<div class="tiny">Aucun job.</div>';
  }catch(e){q("#router").textContent=e.message}
}
q("#go").onclick=async()=>{
  const btn=q("#go");btn.disabled=true;q("#status").textContent="Création du storyboard et mise en file GPU…";
  try{
    const payload={prompt:q("#prompt").value,duration:Number(q("#duration").value),aspect_ratio:q("#aspect").value,model:q("#model").value,reference_images:q("#refs").value.split(",").map(s=>s.trim()).filter(Boolean)};
    const j=await api("/api/jobs",{method:"POST",body:JSON.stringify(payload)});
    q("#status").textContent="Job "+j.id+" créé. Statut: "+j.status+". "+(j.provider?"Worker push: "+j.provider:"En attente d'un worker GPU gratuit.");
    await refresh();
  }catch(e){q("#status").textContent="Erreur: "+e.message}
  finally{btn.disabled=false}
};
refresh();setInterval(refresh,5000);
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "betgpt-video-factory",
        jobs: jobs.length,
        queued: jobs.filter((j) => j.status === "QUEUED_GPU").length,
      });
    }

    if (req.method === "GET" && pathname === "/") return sendHtml(res, html);

    if (pathname.startsWith("/outputs/") && req.method === "GET") {
      const name = path.basename(pathname);
      return serveVideo(req, res, path.join(OUTPUT_DIR, name));
    }

    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/worker/") && !pathname.startsWith("/api/callback/") && !checkApiAuth(req)) {
      return unauthorized(res);
    }

    if (req.method === "GET" && pathname === "/api/capabilities") {
      return sendJson(res, 200, {
        service: "BETGPT VIDEO FACTORY Ω",
        providers: configuredProviders(),
        pull_worker_enabled: Boolean(WORKER_TOKEN),
        max_duration_seconds: 30,
        formats: ["9:16", "16:9", "1:1"],
        truthful_completion_gate: true,
        default_reference_image: ROBOT_REFERENCE_URL,
        quality_mode: "premium-image-to-video",
      });
    }

    if (req.method === "GET" && pathname === "/api/jobs") {
      return sendJson(res, 200, { jobs: jobs.slice().reverse().map(publicJob) });
    }

    if (req.method === "POST" && pathname === "/api/jobs") {
      const input = await readJson(req);
      const job = createJob(input);
      job.reference_images = [ROBOT_REFERENCE_URL, ...job.reference_images.filter((x) => x !== ROBOT_REFERENCE_URL)].slice(0, 4);
      job.quality_preset = "premium-image-to-video";
      job.updated_at = now();
      saveJobs();
      await dispatchPush(job, req);
      return sendJson(res, 201, publicJob(job));
    }

    const retryMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/retry$/);
    if (req.method === "POST" && retryMatch) {
      const job = findJob(retryMatch[1]);
      if (!job) return sendJson(res, 404, { error: "job_not_found" });
      job.status = "QUEUED_GPU";
      job.last_error = null;
      job.updated_at = now();
      saveJobs();
      await dispatchPush(job, req);
      return sendJson(res, 200, publicJob(job));
    }

    const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) {
      const job = findJob(jobMatch[1]);
      if (!job) return sendJson(res, 404, { error: "job_not_found" });
      return sendJson(res, 200, publicJob(job));
    }

    const callbackMatch = pathname.match(/^\/api\/callback\/([^/]+)$/);
    if (req.method === "POST" && callbackMatch) {
      const required = process.env.CALLBACK_SECRET || "";
      if (required && req.headers["x-callback-secret"] !== required) return unauthorized(res);
      const job = findJob(callbackMatch[1]);
      if (!job) return sendJson(res, 404, { error: "job_not_found" });
      const input = await readJson(req);
      job.status = input.status || (input.video_url ? "COMPLETED" : "RUNNING");
      job.progress = Number(input.progress ?? (job.status === "COMPLETED" ? 100 : job.progress || 0));
      job.video_url = input.video_url || job.video_url;
      job.last_error = input.error || null;
      job.updated_at = now();
      saveJobs();
      return sendJson(res, 200, { ok: true });
    }

    if (pathname.startsWith("/api/worker/") && !checkWorkerAuth(req)) return unauthorized(res);

    if (req.method === "POST" && pathname === "/api/worker/claim") {
      const input = await readJson(req).catch(() => ({}));
      const job = jobs.find((j) => j.status === "QUEUED_GPU");
      if (!job) return res.writeHead(204).end();
      job.status = "RUNNING";
      job.provider = input.worker_name || input.backend || "pull-worker";
      job.progress = 1;
      job.updated_at = now();
      saveJobs();
      return sendJson(res, 200, {
        job: publicJob(job),
        upload_url: baseUrl(req) + "/api/worker/upload/" + job.id,
        fail_url: baseUrl(req) + "/api/worker/fail/" + job.id,
      });
    }

    const uploadMatch = pathname.match(/^\/api\/worker\/upload\/([^/]+)$/);
    if (req.method === "PUT" && uploadMatch) {
      const job = findJob(uploadMatch[1]);
      if (!job) return sendJson(res, 404, { error: "job_not_found" });
      const expected = Number(req.headers["content-length"] || 0);
      if (expected && expected > MAX_UPLOAD_BYTES) return sendJson(res, 413, { error: "video_too_large" });

      const filename = job.id + ".mp4";
      const target = path.join(OUTPUT_DIR, filename);
      const temp = target + ".part";
      let received = 0;
      const out = fs.createWriteStream(temp);
      let aborted = false;
      req.on("data", (chunk) => {
        received += chunk.length;
        if (received > MAX_UPLOAD_BYTES && !aborted) {
          aborted = true;
          req.destroy();
          out.destroy();
          try { fs.unlinkSync(temp); } catch {}
        }
      });
      req.pipe(out);
      out.on("finish", () => {
        if (aborted) return;
        fs.renameSync(temp, target);
        job.status = "COMPLETED";
        job.progress = 100;
        job.video_url = baseUrl(req) + "/outputs/" + filename;
        job.updated_at = now();
        job.last_error = null;
        saveJobs();
        sendJson(res, 200, { ok: true, video_url: job.video_url, bytes: received });
      });
      out.on("error", (error) => {
        job.status = "FAILED";
        job.last_error = String(error.message || error);
        job.updated_at = now();
        saveJobs();
        if (!res.headersSent) sendJson(res, 500, { error: "upload_failed" });
      });
      return;
    }

    const failMatch = pathname.match(/^\/api\/worker\/fail\/([^/]+)$/);
    if (req.method === "POST" && failMatch) {
      const job = findJob(failMatch[1]);
      if (!job) return sendJson(res, 404, { error: "job_not_found" });
      const input = await readJson(req).catch(() => ({}));
      job.status = "FAILED";
      job.last_error = String(input.error || "worker_failed").slice(0, 1200);
      job.updated_at = now();
      saveJobs();
      return sendJson(res, 200, { ok: true });
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    sendJson(res, error?.message === "payload_too_large" ? 413 : 500, { error: String(error?.message || error) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`BETGPT_VIDEO_FACTORY_READY port=${PORT} data=${DATA_DIR}`);
});

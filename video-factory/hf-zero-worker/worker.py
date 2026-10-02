import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import imageio_ffmpeg
import requests
from gradio_client import Client

ORCHESTRATOR = os.environ["ORCHESTRATOR_URL"].rstrip("/")
TOKEN = os.environ["GPU_WORKER_TOKEN"]
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "8"))
HF_TOKEN = os.environ.get("HF_TOKEN") or None
BOOTSTRAP_SMOKE = os.environ.get("BOOTSTRAP_SMOKE", "1") == "1"

HEADERS = {"x-worker-token": TOKEN, "content-type": "application/json"}
NEGATIVE = "worst quality, low quality, blurry, jittery, distorted, malformed, watermark, subtitles, captions, text artifacts"

PROVIDERS = [
    ("ltx-zero", "Lightricks/ltx-video-distilled"),
    ("cogvideox-zero", "kaidjuric/cogvideox-5b-text-to-video"),
]

_clients = {}


def client_for(space):
    if space not in _clients:
        print(f"[provider] connecting {space}", flush=True)
        _clients[space] = Client(space, token=HF_TOKEN, verbose=False)
        try:
            _clients[space].view_api(print_info=False)
        except Exception as exc:
            print(f"[provider] api discovery warning {space}: {exc}", flush=True)
    return _clients[space]


def dimensions(aspect):
    if aspect == "9:16":
        return 768, 448
    if aspect == "1:1":
        return 640, 640
    return 448, 768


def normalize_file(result):
    if isinstance(result, (list, tuple)):
        result = result[0]
    if isinstance(result, dict):
        result = result.get("path") or result.get("video") or result.get("url")
    if hasattr(result, "path"):
        result = result.path
    if not result:
        raise RuntimeError("provider returned no video file")
    p = Path(str(result))
    if p.exists():
        return p
    if str(result).startswith(("http://", "https://")):
        target = Path(tempfile.mkstemp(suffix=".mp4")[1])
        with requests.get(str(result), stream=True, timeout=600) as r:
            r.raise_for_status()
            with target.open("wb") as f:
                for chunk in r.iter_content(1024 * 1024):
                    if chunk:
                        f.write(chunk)
        return target
    raise RuntimeError(f"provider output is not a readable file: {result}")


def generate_ltx(prompt, aspect, duration, seed):
    h, w = dimensions(aspect)
    c = client_for("Lightricks/ltx-video-distilled")
    result = c.predict(
        prompt,
        NEGATIVE,
        None,
        None,
        h,
        w,
        "text-to-video",
        max(0.5, min(float(duration), 8.0)),
        9,
        int(seed) % (2**32 - 1),
        False,
        3.0,
        True,
        api_name="/text_to_video",
    )
    return normalize_file(result)


def generate_cog(prompt, aspect, duration, seed):
    c = client_for("kaidjuric/cogvideox-5b-text-to-video")
    frames = 17 if float(duration) <= 2.5 else 33 if float(duration) <= 4.5 else 49
    result = c.predict(
        prompt,
        35,
        frames,
        6.0,
        NEGATIVE,
        int(seed),
        api_name="/generate",
    )
    return normalize_file(result)


def concat_mp4(clips, target, aspect):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    if len(clips) == 1:
        shutil.copy2(clips[0], target)
        return
    h, w = dimensions(aspect)
    manifest = target.with_suffix(".txt")
    manifest.write_text("\n".join(f"file '{str(p).replace(chr(39), chr(39)+chr(92)+chr(39)+chr(39))}'" for p in clips))
    subprocess.run([
        ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(manifest),
        "-vf", f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target)
    ], check=True)


def claim():
    r = requests.post(
        ORCHESTRATOR + "/api/worker/claim",
        headers=HEADERS,
        json={"worker_name": "railway-hf-zerogpu-router", "backend": "hf-zero"},
        timeout=45,
    )
    if r.status_code == 204:
        return None
    r.raise_for_status()
    return r.json()


def fail(url, error):
    try:
        requests.post(url, headers=HEADERS, json={"error": str(error)[:4000]}, timeout=45).raise_for_status()
    except Exception as exc:
        print("[callback] fail callback error", exc, flush=True)


def upload(url, path):
    size = path.stat().st_size
    with path.open("rb") as f:
        r = requests.put(
            url,
            headers={"x-worker-token": TOKEN, "content-type": "video/mp4", "content-length": str(size)},
            data=f,
            timeout=3600,
        )
    r.raise_for_status()
    return r.json()


def process(payload):
    job = payload["job"]
    work = Path(tempfile.mkdtemp(prefix="betgpt-hf-zero-"))
    try:
        shots = job.get("shots") or [{"index": 0, "duration": min(5, job.get("duration", 5)), "prompt": job["prompt"]}]
        aspect = job.get("aspect_ratio", "9:16")
        seed = int(job.get("seed", 42))
        provider_errors = []

        # Pick a provider by actually generating the first shot.
        chosen = None
        first_clip = None
        first = shots[0]
        for provider, _space in PROVIDERS:
            try:
                print(f"[job {job['id']}] trying {provider}", flush=True)
                if provider == "ltx-zero":
                    first_clip = generate_ltx(first["prompt"], aspect, first.get("duration", 5), seed)
                else:
                    first_clip = generate_cog(first["prompt"], aspect, first.get("duration", 5), seed)
                chosen = provider
                break
            except Exception as exc:
                provider_errors.append(f"{provider}: {exc}")
                print(f"[job {job['id']}] {provider} unavailable: {exc}", flush=True)

        if not chosen or not first_clip:
            raise RuntimeError("All free GPU providers failed. " + " | ".join(provider_errors))

        clips = []
        first_target = work / "shot-00.mp4"
        shutil.copy2(first_clip, first_target)
        clips.append(first_target)

        for idx, shot in enumerate(shots[1:], start=1):
            if chosen == "ltx-zero":
                generated = generate_ltx(shot["prompt"], aspect, shot.get("duration", 5), seed + idx)
            else:
                generated = generate_cog(shot["prompt"], aspect, shot.get("duration", 5), seed + idx)
            target = work / f"shot-{idx:02d}.mp4"
            shutil.copy2(generated, target)
            clips.append(target)

        final = work / "betgpt-final.mp4"
        concat_mp4(clips, final, aspect)
        result = upload(payload["upload_url"], final)
        print(f"[job {job['id']}] COMPLETED via {chosen}: {result}", flush=True)
    except Exception as exc:
        print(f"[job {job['id']}] FAILED: {exc}", flush=True)
        fail(payload["fail_url"], exc)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def ensure_smoke_job():
    if not BOOTSTRAP_SMOKE:
        return
    marker = "BETGPT_ZERO_GPU_SMOKE_OMEGA"
    try:
        jobs = requests.get(ORCHESTRATOR + "/api/jobs", timeout=30).json().get("jobs", [])
        if any(marker in j.get("prompt", "") for j in jobs):
            return
        prompt = (
            marker + ". Professional five-second sports advertising shot: "
            "a sleek small futuristic BetGPT robot mascot walks through the tunnel into a floodlit football stadium at night, "
            "cinematic camera push-in, realistic metal reflections, premium commercial lighting, energetic crowd atmosphere, "
            "photorealistic, coherent motion, no text, no watermark."
        )
        r = requests.post(
            ORCHESTRATOR + "/api/jobs",
            json={"prompt": prompt, "duration": 5, "aspect_ratio": "16:9", "model": "auto"},
            timeout=30,
        )
        print("[smoke] create", r.status_code, r.text[:500], flush=True)
    except Exception as exc:
        print("[smoke] creation warning", exc, flush=True)


def main():
    print("BETGPT_HF_ZEROGPU_WORKER_BOOT", flush=True)
    for _, space in PROVIDERS:
        try:
            client_for(space)
            print(f"[provider] READY {space}", flush=True)
        except Exception as exc:
            print(f"[provider] BOOT_WARNING {space}: {exc}", flush=True)
    ensure_smoke_job()
    print("BETGPT_HF_ZEROGPU_WORKER_READY", flush=True)
    while True:
        try:
            payload = claim()
            if payload:
                process(payload)
            else:
                time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            return
        except Exception as exc:
            print("[loop] error", exc, flush=True)
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()

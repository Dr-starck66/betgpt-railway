import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from PIL import Image, ImageFilter

import imageio_ffmpeg
import requests
from gradio_client import Client, handle_file

ORCHESTRATOR = os.environ["ORCHESTRATOR_URL"].rstrip("/")
TOKEN = os.environ["GPU_WORKER_TOKEN"]
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "8"))
HF_TOKEN = os.environ.get("HF_TOKEN") or None
BOOTSTRAP_SMOKE = os.environ.get("BOOTSTRAP_SMOKE", "1") == "1"

HEADERS = {"x-worker-token": TOKEN, "content-type": "application/json"}
NEGATIVE = "worst quality, low quality, blurry, jittery, distorted, malformed, identity drift, character redesign, morphing face, changing armor, extra limbs, extra fingers, duplicated body parts, melted geometry, watermark, subtitles, captions, text artifacts"

PROVIDERS = [
    ("minimax-h3-ref-zero", "multimodalart/minimax-h3-reference"),
    ("wan22-fast-zero", "zerogpu-aoti/wan2-2-fp8da-aoti-faster"),
    ("ltx-zero", "Lightricks/ltx-video-distilled"),
]

_clients = {}


def client_for(space):
    if space not in _clients:
        print(f"[provider] connecting {space}", flush=True)
        _clients[space] = Client(space, hf_token=HF_TOKEN, verbose=False)
        try:
            _clients[space].view_api(print_info=False)
        except Exception as exc:
            print(f"[provider] api discovery warning {space}: {exc}", flush=True)
    return _clients[space]


def dimensions(aspect):
    # Higher native render size than the previous 448x768 profile.
    if aspect == "9:16":
        return 1024, 576
    if aspect == "1:1":
        return 768, 768
    return 576, 1024


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


def generate_minimax_h3(prompt, aspect, duration, seed, reference_image=None):
    if not reference_image:
        raise RuntimeError("minimax-h3-ref-zero requires the locked BetGPT reference image")
    c = client_for("multimodalart/minimax-h3-reference")
    if aspect == "9:16":
        canvas = "768x1344 · 9:16 full"
    elif aspect == "1:1":
        canvas = "768x768 · 1:1 full"
    else:
        canvas = "1344x768 · 16:9 full"

    # API order follows the current Space signature:
    # prompt, image_1, audio, video, canvas, image_2..image_9,
    # match, duration, steps, seed, upsample.
    args = [
        prompt,
        handle_file(str(reference_image)),
        None,
        None,
        canvas,
        None, None, None, None, None, None, None, None,
        False,
        max(2, min(int(round(float(duration))), 5)),
        28,
        int(seed) % 2147483647,
        False,
    ]
    result = c.predict(*args, api_name="/generate")
    return normalize_file(result)


def generate_wan22(prompt, aspect, duration, seed, reference_image=None):
    if not reference_image:
        raise RuntimeError("wan22-fast-zero requires the locked BetGPT reference image")
    c = client_for("zerogpu-aoti/wan2-2-fp8da-aoti-faster")
    duration = max(0.5, min(float(duration), 5.0))
    args = [
        handle_file(str(reference_image)),
        prompt,
        4,
        NEGATIVE,
        duration,
        1.0,
        1.0,
        int(seed) % 2147483647,
        False,
    ]
    errors = []
    for api_name in ("/generate_video", "/predict"):
        try:
            result = c.predict(*args, api_name=api_name)
            return normalize_file(result)
        except Exception as exc:
            errors.append(f"{api_name}: {exc}")
    try:
        result = c.predict(*args, fn_index=0)
        return normalize_file(result)
    except Exception as exc:
        errors.append(f"fn_index=0: {exc}")
    raise RuntimeError("Wan 2.2 Fast call failed. " + " | ".join(errors))


def generate_ltx(prompt, aspect, duration, seed, reference_image=None):
    h, w = dimensions(aspect)
    c = client_for("Lightricks/ltx-video-distilled")
    duration = max(0.5, min(float(duration), 8.0))
    common = [
        prompt,
        NEGATIVE,
        handle_file(str(reference_image)) if reference_image else None,
        None,
        h,
        w,
        "image-to-video" if reference_image else "text-to-video",
        duration,
        9,
        int(seed) % (2**32 - 1),
        False,
        3.5,
        True,
    ]
    result = c.predict(
        *common,
        api_name="/image_to_video" if reference_image else "/text_to_video",
    )
    return normalize_file(result)

def download_reference(url, target):
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with target.open("wb") as f:
            for chunk in r.iter_content(1024 * 1024):
                if chunk:
                    f.write(chunk)
    return target


def prepare_reference_for_aspect(source, aspect, target):
    img = Image.open(source).convert("RGB")
    if aspect == "9:16":
        canvas_w, canvas_h = 576, 1024
    elif aspect == "16:9":
        canvas_w, canvas_h = 1024, 576
    else:
        canvas_w, canvas_h = 768, 768

    # Create a soft background extension from the real reference instead of
    # stretching or cropping the BetGPT robot.
    bg = img.copy()
    bg.thumbnail((canvas_w, canvas_h))
    scale = max(canvas_w / bg.width, canvas_h / bg.height)
    bg = bg.resize((max(canvas_w, int(bg.width * scale)), max(canvas_h, int(bg.height * scale))), Image.Resampling.LANCZOS)
    left = (bg.width - canvas_w) // 2
    top = (bg.height - canvas_h) // 2
    bg = bg.crop((left, top, left + canvas_w, top + canvas_h)).filter(ImageFilter.GaussianBlur(radius=24))
    overlay = Image.new("RGB", (canvas_w, canvas_h), (7, 13, 18))
    overlay = Image.blend(bg, overlay, 0.42)

    fg = img.copy()
    max_w = int(canvas_w * (0.72 if aspect == "16:9" else 0.88))
    max_h = int(canvas_h * 0.88)
    fg.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    x = (canvas_w - fg.width) // 2
    y = (canvas_h - fg.height) // 2
    overlay.paste(fg, (x, y))
    overlay.save(target, quality=96, subsampling=0)
    return target


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
    manifest = target.with_suffix(".txt")
    manifest.write_text("\n".join(f"file '{str(p).replace(chr(39), chr(39)+chr(92)+chr(39)+chr(39))}'" for p in clips))
    if aspect == "9:16":
        out_w, out_h = 1080, 1920
    elif aspect == "1:1":
        out_w, out_h = 1080, 1080
    else:
        out_w, out_h = 1920, 1080
    subprocess.run([
        ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(manifest),
        "-vf", f"scale={out_w}:{out_h}:force_original_aspect_ratio=increase:flags=lanczos,crop={out_w}:{out_h},setsar=1,unsharp=5:5:0.35:5:5:0.0",
        "-c:v", "libx264", "-preset", "slow", "-crf", "17",
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


def upload(url, path, provider=None):
    size = path.stat().st_size
    headers = {"x-worker-token": TOKEN, "content-type": "video/mp4", "content-length": str(size)}
    if provider:
        headers["x-video-provider"] = provider
    with path.open("rb") as f:
        r = requests.put(
            url,
            headers=headers,
            data=f,
            timeout=3600,
        )
    r.raise_for_status()
    return r.json()


def process(payload):
    job = payload["job"]
    work = Path(tempfile.mkdtemp(prefix="betgpt-hf-zero-"))
    try:
        shots = job.get("shots") or [{"index": 0, "duration": min(4, job.get("duration", 4)), "prompt": job["prompt"]}]
        aspect = job.get("aspect_ratio", "9:16")
        seed = int(job.get("seed", 42))
        provider_errors = []
        reference = None
        refs = job.get("reference_images") or []
        if refs:
            raw_reference = download_reference(refs[0], work / "betgpt-reference-raw.png")
            reference = prepare_reference_for_aspect(raw_reference, aspect, work / "betgpt-reference-aspect.jpg")
            print(f"[job {job['id']}] reference image prepared for {aspect}: {reference}", flush=True)

        # Honor an explicit model choice; AUTO benchmarks/fails over in quality order.
        requested_model = job.get("model", "auto")
        candidates = PROVIDERS
        if requested_model == "wan22":
            candidates = [p for p in PROVIDERS if p[0] == "wan22-fast-zero"]
        elif requested_model == "ltx2":
            candidates = [p for p in PROVIDERS if p[0] == "ltx-zero"]

        chosen = None
        first_clip = None
        first = shots[0]
        for provider, _space in candidates:
            try:
                print(f"[job {job['id']}] trying {provider}", flush=True)
                if provider == "minimax-h3-ref-zero":
                    first_clip = generate_minimax_h3(first["prompt"], aspect, first.get("duration", 4), seed, reference)
                elif provider == "wan22-fast-zero":
                    first_clip = generate_wan22(first["prompt"], aspect, first.get("duration", 4), seed, reference)
                elif provider == "ltx-zero":
                    first_clip = generate_ltx(first["prompt"], aspect, first.get("duration", 4), seed, reference)
                else:
                    raise RuntimeError(f"unsupported provider {provider}")
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
            if chosen == "minimax-h3-ref-zero":
                generated = generate_minimax_h3(shot["prompt"], aspect, shot.get("duration", 4), seed + idx, reference)
            elif chosen == "wan22-fast-zero":
                generated = generate_wan22(shot["prompt"], aspect, shot.get("duration", 4), seed + idx, reference)
            elif chosen == "ltx-zero":
                generated = generate_ltx(shot["prompt"], aspect, shot.get("duration", 4), seed + idx, reference)
            else:
                raise RuntimeError(f"unsupported provider {chosen}")
            target = work / f"shot-{idx:02d}.mp4"
            shutil.copy2(generated, target)
            clips.append(target)

        final = work / "betgpt-final.mp4"
        concat_mp4(clips, final, aspect)
        result = upload(payload["upload_url"], final, chosen)
        print(f"[job {job['id']}] COMPLETED via {chosen}: {result}", flush=True)
    except Exception as exc:
        print(f"[job {job['id']}] FAILED: {exc}", flush=True)
        fail(payload["fail_url"], exc)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def ensure_smoke_job():
    if not BOOTSTRAP_SMOKE:
        return
    marker = os.environ.get("SMOKE_MARKER", "BETGPT_ZERO_GPU_SMOKE_OMEGA_V10_MINIMAX_H3")
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
            json={"prompt": prompt, "duration": 5, "aspect_ratio": "9:16", "model": "auto"},
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

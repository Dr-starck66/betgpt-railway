"""
BETGPT VIDEO FACTORY Ω — Wan 2.2 pull worker.

Designed for an ephemeral CUDA machine such as a Kaggle GPU notebook.
It polls the Railway orchestrator, generates real 5-second Wan 2.2 shots,
concatenates them with ffmpeg, then uploads the final MP4.

Required env:
  ORCHESTRATOR_URL=https://...
  GPU_WORKER_TOKEN=...
Optional:
  WAN_REPO=/kaggle/working/Wan2.2
  WAN_CKPT=/kaggle/working/Wan2.2-TI2V-5B
  HF_HOME=/kaggle/working/hf-cache
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import requests

ORCHESTRATOR = os.environ.get("ORCHESTRATOR_URL", "").rstrip("/")
TOKEN = os.environ.get("GPU_WORKER_TOKEN", "")
WAN_REPO = Path(os.environ.get("WAN_REPO", "/kaggle/working/Wan2.2"))
WAN_CKPT = Path(os.environ.get("WAN_CKPT", "/kaggle/working/Wan2.2-TI2V-5B"))
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "20"))
BOOTSTRAP = os.environ.get("BOOTSTRAP_WAN", "1") == "1"

HEADERS = {"x-worker-token": TOKEN, "content-type": "application/json"}

def run(cmd, cwd=None):
    print("+", " ".join(map(str, cmd)), flush=True)
    subprocess.run(list(map(str, cmd)), cwd=cwd, check=True)

def check_gpu():
    try:
        out = subprocess.check_output(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"], text=True)
        print("GPU:", out.strip(), flush=True)
    except Exception as exc:
        raise RuntimeError("CUDA/NVIDIA GPU unavailable") from exc

def bootstrap_wan():
    check_gpu()
    if not WAN_REPO.exists():
        run(["git", "clone", "--depth", "1", "https://github.com/Wan-Video/Wan2.2.git", WAN_REPO])
    if BOOTSTRAP:
        marker = WAN_REPO / ".betgpt_requirements_ok"
        if not marker.exists():
            run([sys.executable, "-m", "pip", "install", "-r", WAN_REPO / "requirements.txt"])
            marker.write_text("ok")
    if not WAN_CKPT.exists():
        run([
            sys.executable, "-m", "huggingface_hub.commands.huggingface_cli",
            "download", "Wan-AI/Wan2.2-TI2V-5B",
            "--local-dir", WAN_CKPT
        ])

def size_for(aspect):
    if aspect == "9:16":
        return "704*1280"
    return "1280*704"

def generate_clip(prompt, aspect, seed, output_path, reference_image=None):
    cmd = [
        sys.executable, "generate.py",
        "--task", "ti2v-5B",
        "--size", size_for(aspect),
        "--ckpt_dir", str(WAN_CKPT),
        "--offload_model", "True",
        "--convert_model_dtype",
        "--t5_cpu",
        "--base_seed", str(seed),
        "--save_file", str(output_path),
        "--prompt", prompt,
    ]
    if reference_image:
        cmd += ["--image", reference_image]
    run(cmd, cwd=WAN_REPO)

def download_reference(url, target):
    r = requests.get(url, timeout=90)
    r.raise_for_status()
    target.write_bytes(r.content)
    return str(target)

def concat_clips(clips, final_path):
    if len(clips) == 1:
        shutil.copy2(clips[0], final_path)
        return
    manifest = final_path.with_suffix(".txt")
    manifest.write_text("\n".join("file '" + str(p).replace("'", "'\\''") + "'" for p in clips))
    run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", manifest,
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", final_path
    ])

def claim_job():
    r = requests.post(
        ORCHESTRATOR + "/api/worker/claim",
        headers=HEADERS,
        json={"worker_name": "kaggle-wan22", "backend": "wan22"},
        timeout=45,
    )
    if r.status_code == 204:
        return None
    r.raise_for_status()
    return r.json()

def fail_job(url, error):
    try:
        requests.post(url, headers=HEADERS, json={"error": str(error)}, timeout=30).raise_for_status()
    except Exception as callback_error:
        print("Failure callback error:", callback_error, flush=True)

def upload_video(url, path):
    size = path.stat().st_size
    with path.open("rb") as fh:
        r = requests.put(
            url,
            headers={"x-worker-token": TOKEN, "content-type": "video/mp4", "content-length": str(size)},
            data=fh,
            timeout=3600,
        )
    r.raise_for_status()
    return r.json()

def process(payload):
    job = payload["job"]
    work = Path(tempfile.mkdtemp(prefix="betgpt-video-"))
    try:
        reference = None
        refs = job.get("reference_images") or []
        if refs:
            reference = download_reference(refs[0], work / "reference.jpg")

        clips = []
        for shot in job.get("shots") or [{"prompt": job["prompt"]}]:
            idx = int(shot.get("index", len(clips)))
            clip = work / f"shot-{idx:02d}.mp4"
            generate_clip(
                shot.get("prompt") or job["prompt"],
                job.get("aspect_ratio", "9:16"),
                int(job.get("seed", 42)) + idx,
                clip,
                reference,
            )
            clips.append(clip)

        final_path = work / "betgpt-final.mp4"
        concat_clips(clips, final_path)
        result = upload_video(payload["upload_url"], final_path)
        print("COMPLETED", json.dumps(result), flush=True)
    except Exception as exc:
        print("FAILED", repr(exc), flush=True)
        fail_job(payload["fail_url"], exc)
    finally:
        shutil.rmtree(work, ignore_errors=True)

def main():
    if not ORCHESTRATOR or not TOKEN:
        raise SystemExit("ORCHESTRATOR_URL and GPU_WORKER_TOKEN are required")
    bootstrap_wan()
    print("BETGPT Wan 2.2 worker ready", flush=True)
    while True:
        try:
            payload = claim_job()
            if payload:
                process(payload)
            else:
                time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            return
        except Exception as exc:
            print("Worker loop error:", repr(exc), flush=True)
            time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    main()

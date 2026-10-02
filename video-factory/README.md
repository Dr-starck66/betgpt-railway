# BETGPT VIDEO FACTORY Ω

Cloud orchestrator for BetGPT advertising videos.

## Architecture

- Railway hosts the control plane, UI, queue, job state and final MP4 files.
- GPU inference is delegated to interchangeable workers.
- Supported routing targets: Wan 2.2, SkyReels V3 and LTX-2.
- A pull-worker protocol allows free/ephemeral GPU notebooks (for example Kaggle) to consume jobs without exposing an inbound port.

## Truth gate

A job is never marked COMPLETED until a real MP4 has either been returned by a configured push worker or uploaded by an authenticated pull worker.

## Railway

Set the service root directory to `/video-factory`.

Required for pull workers:

- `GPU_WORKER_TOKEN` — shared secret between Railway and GPU workers.
- `DATA_DIR=/data` when a persistent Railway volume is mounted.

Optional push workers:

- `WAN22_WORKER_URL`
- `SKYREELS_WORKER_URL`
- `LTX2_WORKER_URL`
- `CALLBACK_SECRET`
- `PUBLIC_BASE_URL`
- `VIDEO_FACTORY_API_KEY`

Healthcheck: `/health`

## Worker protocol

1. `POST /api/worker/claim` with `x-worker-token`.
2. Generate every storyboard shot with a real video model.
3. Assemble the MP4.
4. `PUT /api/worker/upload/:jobId` with the MP4 bytes.
5. The Railway job becomes COMPLETED only after the upload is stored.

The reference Wan 2.2 worker is in `gpu-worker/kaggle_wan22_worker.py`.

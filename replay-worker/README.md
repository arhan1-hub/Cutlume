# Cutlume Replay Worker (private prototype)

This service executes Playwright jobs in a separate Node.js container. It is not deployed by the website build. Run one worker replica only for this in-memory queue prototype.

## Run locally with Docker

From the repository root:

```bash
docker build -f replay-worker/Dockerfile -t cutlume-replay-worker .
docker run --rm -p 8787:8787 \
  -e CUTLUME_REPLAY_TOKEN='replace-with-a-long-random-secret' \
  -e CUTLUME_REPLAY_ALLOWED_HOSTS='your-test-host.example' \
  -e CUTLUME_REPLAY_DATA_DIR='/data/jobs' \
  -v cutlume-replay-jobs:/data/jobs \
  cutlume-replay-worker
``

Set the matching worker URL, token, and allowed host list in the Vercel **preview environment only**. Do not expose this worker publicly without network controls and request rate limits.

## Endpoints

- GET /healthz — health only; no secrets.
- POST /jobs — authenticated; validated workflow; returns 202 and job ID.
- GET /jobs/:id — authenticated status and sanitized report.
- GET /jobs/:id/video — authenticated MP4 (preferred) or WebM when completed.

## Safety limits

The worker rejects non-allowlisted targets, credentials in URLs, private/local DNS results, excessive payloads, unsupported actions, more than 30 steps, and oversized fields. Hosted uploads accept only the packaged `./fixtures/demo-image.svg` sample and require an accessible attach-button locator; arbitrary file paths and coordinate-triggered uploads are rejected. Each job runs in its own output directory with a 3-minute timeout; one active job at a time and a small queue. Upload actions are restricted to a packaged fixture. Do not provide production credentials or real payment flows.

Important: DNS checks alone cannot fully prevent DNS rebinding. Before public production use, deploy behind egress/network policy that blocks private, loopback, link-local, multicast, and cloud metadata networks; use an isolated container/VM per job, persistent job storage, and an external queue. The in-memory status registry resets on restart and is intentionally prototype-grade.

# Cutlume replay worker connection

The website currently creates workflow JSON; browser recording runs locally through npm run demo:replay. These API routes are a secure integration seam for a separately hosted Node.js worker that runs Playwright and FFmpeg. They do not run Chromium inside Vercel.

## Server environment variables

Configure these only in the Vercel prototype branch/preview deployment:

- CUTLUME_REPLAY_WORKER_URL: HTTPS base URL of the private worker service.
- CUTLUME_REPLAY_WORKER_TOKEN: long random bearer token shared with the worker. Never use a NEXT_PUBLIC_ variable.
- CUTLUME_REPLAY_ALLOWED_HOSTS: comma-separated hostnames the worker may visit, e.g. demo.example.com,staging.example.org. Use test deployments only.

The POST route forwards a workflow to POST /jobs on the worker and returns its response with HTTP 202. The status route forwards to GET /jobs/:jobId. The worker contract should return JSON and use stable job IDs containing only letters, numbers, underscores, and hyphens.

## Required worker-side protections

The worker must independently validate all input; never trust only the Next.js proxy. It must:
- Require the same bearer token and use constant-time token comparison.
- Re-validate target host allowlisting after DNS resolution; reject loopback, private, link-local, multicast, and cloud metadata IP ranges to prevent DNS-rebinding/SSRF.
- Enforce a job queue, concurrency limits, a strict wall-clock timeout, memory limits, and a maximum of 30 steps.
- Run browser jobs in isolated temporary directories/containers; never expose the worker filesystem.
- Restrict file uploads to packaged test fixtures, not arbitrary paths supplied by clients.
- Return only job status, sanitized logs, and an expiring video URL or a video served from authenticated storage. Never return secrets or full environment variables.
- Expire and delete recordings and screenshots after a short retention period.
- Use only dummy accounts, a test database, and simulated payments.

## Current status

No worker host or shared token has been configured, so the routes return a clear not_configured/503 response. This is intentional: it prevents a misleading Generate Demo success before a real worker exists. The local Playwright runner and CI smoke test remain the verified path for browser replay.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = new Set(["goto", "click", "clickAt", "fill", "type", "typeAt", "press", "upload", "wait", "waitForSelector", "waitForText", "waitForStableText", "scroll", "screenshot"]);
const MAX_STEPS = 30;
const MAX_BODY_BYTES = 64 * 1024;
const recentJobs = new Map<string, number[]>();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_JOBS_PER_WINDOW = 3;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
function configuredHosts() {
  const configured = (process.env.CUTLUME_REPLAY_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  // Allow this explicitly approved test app on Vercel Preview only; production stays env-configured.
  if (process.env.VERCEL_ENV === "preview") configured.push("flutter-ai-starter-kit-demo.dooettli.workers.dev");
  return [...new Set(configured)];
}
function validateTarget(raw: unknown) {
  if (typeof raw !== "string" || raw.length > 2048) return "A valid target URL is required.";
  let url: URL;
  try { url = new URL(raw); } catch { return "Target URL must be a complete URL."; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Only HTTP(S) target URLs are allowed.";
  if (url.username || url.password) return "Credentials must not be embedded in the target URL.";
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
      hostname === "127.0.0.1" || hostname === "::1" || /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname === "169.254.169.254") return "Private or local network targets are not allowed.";
  const allowed = configuredHosts();
  if (!allowed.length) return "Replay is not configured yet. Set CUTLUME_REPLAY_ALLOWED_HOSTS on the server.";
  if (!allowed.some((host) => hostname === host || hostname.endsWith("." + host))) return "This target host is not on the replay allowlist.";
  return null;
}

export async function GET() {
  const ready = Boolean(process.env.CUTLUME_REPLAY_WORKER_URL && process.env.CUTLUME_REPLAY_WORKER_TOKEN && configuredHosts().length);
  return NextResponse.json({ configured: ready, status: ready ? "ready" : "not_configured" }, { status: ready ? 200 : 503 });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return jsonError("Cross-origin replay requests are not allowed.", 403);
    } catch {
      return jsonError("Invalid request origin.", 403);
    }
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = request.headers.get("x-real-ip") || forwarded || "unknown";
  const now = Date.now();
  const recent = (recentJobs.get(clientKey) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= MAX_JOBS_PER_WINDOW) return jsonError("Replay limit reached for this network. Try again later.", 429);
  const workerUrl = process.env.CUTLUME_REPLAY_WORKER_URL;
  const workerToken = process.env.CUTLUME_REPLAY_WORKER_TOKEN;
  if (!workerUrl || !workerToken || !configuredHosts().length) return jsonError("Replay service is not connected yet. The workflow can still be downloaded as JSON.", 503);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return jsonError("Workflow payload is too large.", 413);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Request body must be valid JSON.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("Workflow object is required.", 400);
  const workflow = body as Record<string, unknown>;
  const targetError = validateTarget(workflow.baseUrl);
  if (targetError) return jsonError(targetError, 400);
  if (!Array.isArray(workflow.steps) || workflow.steps.length < 1 || workflow.steps.length > MAX_STEPS) return jsonError("Workflow must contain between 1 and " + MAX_STEPS + " steps.", 400);
  for (const [index, item] of workflow.steps.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return jsonError("Step " + (index + 1) + " is invalid.", 400);
    const step = item as Record<string, unknown>;
    if (typeof step.action !== "string" || !ALLOWED_ACTIONS.has(step.action)) return jsonError("Step " + (index + 1) + " uses an unsupported action.", 400);
    for (const key of ["label", "selector", "value", "text", "caption"]) {
      if (step[key] !== undefined && (typeof step[key] !== "string" || (step[key] as string).length > 2000)) return jsonError("Step " + (index + 1) + " has an invalid " + key + " field.", 400);
    }
  }
  let endpoint: URL;
  try {
    endpoint = new URL("/jobs", workerUrl);
    if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") return jsonError("Replay worker URL must use HTTPS.", 500);
  } catch { return jsonError("Replay worker URL is invalid.", 500); }
  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + workerToken },
      body: JSON.stringify(workflow),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) { const workerError = typeof payload?.error === "string" ? payload.error.slice(0, 300) : "No diagnostic was returned by the worker."; return jsonError(`Replay worker returned HTTP ${upstream.status}: ${workerError}`, upstream.status === 429 ? 429 : 502); }
    recent.push(now);
    recentJobs.set(clientKey, recent);
    return NextResponse.json(payload, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Could not reach the replay worker. The job was not confirmed.", 502); }
}

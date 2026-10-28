import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import dns from "node:dns/promises";
import net from "node:net";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.CUTLUME_REPLAY_TOKEN || "";
const HOSTS = [...new Set([...(process.env.CUTLUME_REPLAY_ALLOWED_HOSTS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean), "flutter-ai-starter-kit-demo.dooettli.workers.dev"])];
const DATA = path.resolve(process.env.CUTLUME_REPLAY_DATA_DIR || path.join(os.tmpdir(), "cutlume-jobs"));
const MAX_BYTES = 64 * 1024;
const MAX_STEPS = 30;
const MAX_JOBS = 3;
const TIMEOUT_MS = 180_000;
const RETENTION_MS = 6 * 60 * 60 * 1000;
const ACTIONS = new Set(["goto", "click", "clickAt", "fill", "type", "typeAt", "press", "upload", "wait", "waitForSelector", "waitForText", "waitForStableText", "scroll", "screenshot"]);
const jobs = new Map();
const queue = [];
let active = false;

function reply(res, status, value, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(value));
}
function bearer(req) {
  const header = req.headers.authorization || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(TOKEN);
  return Boolean(TOKEN && a.length === b.length && crypto.timingSafeEqual(a, b));
}
function privateAddress(address) {
  if (net.isIPv4(address)) {
    const p = address.split(".").map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
  }
  if (net.isIPv6(address)) {
    const x = address.toLowerCase();
    return x === "::" || x === "::1" || x.startsWith("fe8") || x.startsWith("fe9") ||
      x.startsWith("fea") || x.startsWith("feb") || x.startsWith("fc") || x.startsWith("fd") ||
      x.startsWith("ff") || x.startsWith("::ffff:127.") || x.startsWith("::ffff:10.") ||
      x.startsWith("::ffff:192.168.") || x.startsWith("::ffff:169.254.");
  }
  return true;
}
async function validateTarget(raw) {
  if (typeof raw !== "string" || raw.length > 2048) throw new Error("Target URL is required.");
  let url;
  try { url = new URL(raw); } catch { throw new Error("Target URL must be a complete URL."); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Only HTTP(S) URLs without embedded credentials are allowed.");
  const host = url.hostname.toLowerCase();
  if (!HOSTS.some(allowed => host === allowed || host.endsWith("." + allowed))) throw new Error("Target host is not on the worker allowlist.");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost")) throw new Error("Local targets are not allowed.");
  const records = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true, verbatim: true });
  if (!records.length || records.some(record => privateAddress(record.address))) throw new Error("Target resolves to a private or non-public IP address.");
  return url.href;
}
function validateWorkflow(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Workflow object is required.");
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > MAX_STEPS) throw new Error("Workflow must have between 1 and " + MAX_STEPS + " steps.");
  for (const [i, raw] of value.steps.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || !ACTIONS.has(raw.action)) throw new Error("Step " + (i + 1) + " has an unsupported action.");
    for (const key of ["label", "selector", "value", "text", "caption", "url", "file", "role", "name", "placeholder", "testId", "locatorLabel"]) {
      if (raw[key] !== undefined && (typeof raw[key] !== "string" || raw[key].length > 2000)) throw new Error("Step " + (i + 1) + " has an invalid " + key + " field.");
    }
    if (raw.exact !== undefined && typeof raw.exact !== "boolean") throw new Error("Step " + (i + 1) + " has an invalid exact field.");
    if (raw.trigger && typeof raw.trigger === "object" && !Array.isArray(raw.trigger)) {
      for (const key of ["selector", "role", "name", "text", "label", "locatorLabel", "placeholder", "testId"]) {
        if (raw.trigger[key] !== undefined && (typeof raw.trigger[key] !== "string" || raw.trigger[key].length > 2000)) throw new Error("Step " + (i + 1) + " has an invalid upload trigger " + key + " field.");
      }
      if (raw.trigger.exact !== undefined && typeof raw.trigger.exact !== "boolean") throw new Error("Step " + (i + 1) + " has an invalid upload trigger exact field.");
    }
    if (raw.action === "upload") {
      if (raw.file !== "./fixtures/demo-image.svg") throw new Error("Hosted uploads only support the packaged sample image.");
      const trigger = raw.trigger;
      if (!trigger || typeof trigger !== "object" || Array.isArray(trigger)) throw new Error("Sample upload needs an accessible attach-button target.");
      const hasTrigger = (typeof trigger.selector === "string" && trigger.selector.length > 0) ||
        (typeof trigger.role === "string" && typeof trigger.name === "string" && trigger.name.length > 0) ||
        (typeof trigger.text === "string" && trigger.text.length > 0) ||
        (typeof trigger.label === "string" && trigger.label.length > 0) ||
        (typeof trigger.locatorLabel === "string" && trigger.locatorLabel.length > 0) ||
        (typeof trigger.placeholder === "string" && trigger.placeholder.length > 0) ||
        (typeof trigger.testId === "string" && trigger.testId.length > 0);
      if (!hasTrigger || "x" in trigger || "y" in trigger) throw new Error("Sample upload needs a supported accessible attach-button target; coordinates are not accepted.");
    }
    if (raw.action === "goto") throw new Error("Additional navigation steps are disabled; the worker visits only the allowlisted base URL.");
    if (raw.action === "clickAt" || raw.action === "typeAt") throw new Error("Coordinate actions are disabled in hosted mode; use stable accessible selectors.");
    if (raw.action === "wait" && Number(raw.ms) > 30000) throw new Error("Pause cannot exceed 30 seconds.");
  }
}
function safeJob(job) {
  return { id: job.id, status: job.status, createdAt: job.createdAt, startedAt: job.startedAt || null, finishedAt: job.finishedAt || null, progress: job.progress, error: job.error || null, videoAvailable: job.status === "completed" && Boolean(job.videoPath) };
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw Object.assign(new Error("Payload too large."), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function execute(job) {
  active = true;
  job.status = "running";
  job.startedAt = new Date().toISOString();
  job.progress = { currentStep: 0, totalSteps: job.workflow.steps.length, message: "Starting isolated browser run" };
  const dir = path.join(DATA, job.id);
  await fs.mkdir(dir, { recursive: true });
  const configPath = path.join(dir, "workflow.json");
  const config = { ...job.workflow, baseUrl: job.target, outputDir: dir, name: "cutlume-" + job.id };
  await fs.writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
  const proc = spawn(process.execPath, [path.join(ROOT, "scripts", "demo-replay.mjs"), "--config", configPath, "--headless", "--slow-mo", "0"], {
    cwd: ROOT, env: { ...process.env, CUTLUME_REPLAY_JOB_ID: job.id, CUTLUME_REPLAY_ENFORCE_HOST_ALLOWLIST: "1" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  let pendingOutput = "";
  const append = chunk => {
    const text = chunk.toString();
    logs = (logs + text).slice(-12000);
    pendingOutput = (pendingOutput + text).slice(-4000);
    const matches = [...pendingOutput.matchAll(/\[(\d+)\/(\d+)\]\s+([^\r\n]+)/g)];
    const latest = matches.at(-1);
    if (latest) job.progress = { currentStep: Number(latest[1]), totalSteps: Number(latest[2]), message: latest[3].trim().slice(0, 180) };
    if (pendingOutput.length > 3000) pendingOutput = pendingOutput.slice(-1000);
  };
  proc.stdout.on("data", append);
  proc.stderr.on("data", append);
  const timeout = setTimeout(() => { proc.kill("SIGKILL"); }, TIMEOUT_MS);
  const code = await new Promise((resolve) => {
    proc.once("error", (error) => {
      logs = (logs + "\n[worker spawn error] " + error.message).slice(-12000);
      resolve(null);
    });
    proc.once("close", (exitCode, signal) => {
      if (signal) logs = (logs + "\n[worker signal] " + signal).slice(-12000);
      resolve(exitCode);
    });
  });
  clearTimeout(timeout);
  if (code !== 0) {
    console.error(`[replay-job ${job.id}] subprocess exited with code ${String(code)}; captured output follows`);
    console.error(logs.slice(-12000) || "[replay-job] subprocess produced no stdout/stderr");
  }
  const entries = await fs.readdir(dir).catch(() => []);
  const reportName = entries.filter(name => name.endsWith(".report.json")).sort().at(-1);
  let report = null;
  if (reportName) {
    try { report = JSON.parse(await fs.readFile(path.join(dir, reportName), "utf8")); } catch {}
  }
  job.report = report ? { status: report.status, totalSteps: report.totalSteps, completedSteps: report.completedSteps, failure: report.failure ? { message: String(report.failure.message || "Replay failed").slice(0, 500), step: report.failure.step, label: report.failure.label } : null, mp4Status: report.mp4Status } : null;
  job.logs = logs;
  job.finishedAt = new Date().toISOString();
  if (code === 0 && report?.status === "passed") {
    const videoName = entries.find(name => name.endsWith(".mp4")) || entries.find(name => name.endsWith(".webm"));
    if (videoName) {
      job.videoPath = path.join(dir, videoName);
      job.videoType = videoName.endsWith(".mp4") ? "video/mp4" : "video/webm";
      job.status = "completed";
      job.progress = { currentStep: job.workflow.steps.length, totalSteps: job.workflow.steps.length, message: "Recording ready" };
    } else {
      job.status = "failed"; job.error = "Replay finished without a recording.";
    }
  } else {
    job.status = "failed";
    const logTail = logs.trim().slice(-1800);
    job.error = code === null
      ? (logs.includes("[worker spawn error]") ? "Could not start the replay process: " + logs.split("[worker spawn error]").at(-1).trim().slice(0, 500) : "Replay timed out after 3 minutes. Check the target app and workflow selectors.")
      : (job.report?.failure?.message
        ? `Step ${job.report.failure.step || "?"}${job.report.failure.label ? ` (${job.report.failure.label})` : ""}: ${job.report.failure.message}`
        : `Replay process exited with code ${String(code)}; report status: ${job.report?.status || "missing"}.${logTail ? " Worker diagnostic: " + logTail.replace(/\\s+/g, " ").slice(-1200) : " No subprocess output was captured; check the worker image and Playwright installation."}`);
  }
  await fs.rm(configPath, { force: true }).catch(() => {});
  active = false;
  if (queue.length) void execute(queue.shift());
}
async function cleanupExpired() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    const created = Date.parse(job.createdAt || "");
    if (Number.isFinite(created) && now - created > RETENTION_MS && !["queued", "running"].includes(job.status)) {
      jobs.delete(id);
      await fs.rm(path.join(DATA, id), { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function handle(req, res) {
  const url = new URL(req.url || "/", "http://worker.local");
  if (url.pathname === "/healthz" && req.method === "GET") return reply(res, 200, { ok: true, configured: Boolean(TOKEN && HOSTS.length) });
  if (!bearer(req)) return reply(res, 401, { error: "Unauthorized." });
  if (req.method === "POST" && url.pathname === "/jobs") {
    try {
      const workflow = await readBody(req);
      validateWorkflow(workflow);
      const target = await validateTarget(workflow.baseUrl);
      if (jobs.size >= 100) {
        for (const [id, job] of jobs) if (["completed", "failed"].includes(job.status)) jobs.delete(id);
      }
      if (jobs.size >= 100) return reply(res, 429, { error: "Worker job registry is full. Try later." });
      if (active && queue.length >= MAX_JOBS - 1) return reply(res, 429, { error: "Replay queue is full. Try again shortly." });
      const id = crypto.randomUUID().replace(/-/g, "");
      const job = { id, status: "queued", createdAt: new Date().toISOString(), progress: { currentStep: 0, totalSteps: workflow.steps.length, message: "Queued" }, workflow: { ...workflow, baseUrl: target } };
      jobs.set(id, job);
      if (!active) void execute(job); else queue.push(job);
      return reply(res, 202, { id, status: job.status, statusUrl: "/jobs/" + id, videoUrl: "/jobs/" + id + "/video" });
    } catch (error) {
      return reply(res, error.status || 400, { error: String(error.message || "Invalid workflow").slice(0, 500) });
    }
  }
  const match = url.pathname.match(/^\/jobs\/([a-f0-9]{32})(\/video)?$/);
  if (req.method === "GET" && match) {
    const job = jobs.get(match[1]);
    if (!job) return reply(res, 404, { error: "Job not found or worker restarted." });
    if (match[2] === "/video") {
      if (job.status !== "completed" || !job.videoPath) return reply(res, 409, { error: "Video is not ready yet." });
      try {
        const stat = await fs.stat(job.videoPath);
        res.writeHead(200, { "content-type": job.videoType, "content-length": stat.size, "cache-control": "private, no-store", "content-disposition": 'attachment; filename="cutlume-demo.' + (job.videoType === "video/mp4" ? "mp4" : "webm") + '"' });
        return fs.createReadStream(job.videoPath).pipe(res);
      } catch { return reply(res, 410, { error: "Recording expired." }); }
    }
    return reply(res, 200, { ...safeJob(job), report: job.report || null, videoUrl: job.status === "completed" ? "/jobs/" + job.id + "/video" : null });
  }
  return reply(res, 404, { error: "Not found." });
}
await fs.mkdir(DATA, { recursive: true });
setInterval(() => { void cleanupExpired(); }, 15 * 60 * 1000).unref();
http.createServer((req, res) => { void handle(req, res).catch(() => { if (!res.headersSent) reply(res, 500, { error: "Internal worker error." }); else res.destroy(); }); }).listen(PORT, "0.0.0.0", () => {
  console.log("Cutlume replay worker listening on port " + PORT);
  if (!TOKEN || !HOSTS.length) console.warn("Worker is not configured; set CUTLUME_REPLAY_TOKEN and CUTLUME_REPLAY_ALLOWED_HOSTS.");
});

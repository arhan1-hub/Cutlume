#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const configPath = path.resolve(arg("--config", "demo-flow.json"));
const urlOverride = arg("--url");
const headless = process.argv.includes("--headless");
const slowMo = Number(arg("--slow-mo", "120"));
const shouldConvertMp4 = !process.argv.includes("--no-mp4");
let config;

try {
  config = JSON.parse(await fs.readFile(configPath, "utf8"));
} catch (error) {
  if (error?.code === "ENOENT" && configPath === path.resolve("demo-flow.json")) {
    console.error(`Config not found: ${configPath}`);
    console.error("Create it first with: cp demo-flow.example.json demo-flow.json");
  } else {
    console.error(`Could not read or parse config: ${configPath}`);
    console.error(error instanceof Error ? error.message : error);
  }
  process.exit(1);
}

const baseUrl = urlOverride || config.baseUrl;
if (!baseUrl) {
  console.error("Set baseUrl in the config or pass --url https://your-demo.example");
  process.exit(1);
}
if (!Array.isArray(config.steps) || config.steps.length === 0) {
  console.error("The config needs a non-empty steps array.");
  process.exit(1);
}

const outputDir = path.resolve(config.outputDir || "recordings");
await fs.mkdir(outputDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const safeName = (config.name || "cutlume-demo").replace(/[^a-z0-9-_]+/gi, "-");
const outputPath = path.join(outputDir, `${safeName}-${stamp}.webm`);
const reportPath = path.join(outputDir, `${safeName}-${stamp}.report.json`);
const viewport = config.viewport || { width: 1440, height: 900 };

let browser;
let context;
let page;
let video;
let failedStep = null;
let failure = null;
const completedSteps = [];

function getLocator(step) {
  if (step.selector) return page.locator(step.selector).first();
  if (step.role) return page.getByRole(step.role, { name: step.name, exact: step.exact ?? false }).first();
  if (step.text) return page.getByText(step.text, { exact: step.exact ?? false }).first();
  if (step.label) return page.getByLabel(step.label, { exact: step.exact ?? false }).first();
  if (step.placeholder) return page.getByPlaceholder(step.placeholder, { exact: step.exact ?? false }).first();
  if (step.testId) return page.getByTestId(step.testId).first();
  return null;
}

function hasCoordinates(step) {
  return Number.isFinite(step.x) && Number.isFinite(step.y);
}

async function clickTarget(step) {
  if (hasCoordinates(step)) {
    await page.mouse.click(step.x, step.y, { clickCount: step.clickCount || 1, delay: step.delay || 0 });
    return;
  }
  const locator = getLocator(step);
  if (!locator) {
    throw new Error("click needs selector, role + name, text, label, testId, or numeric x/y coordinates");
  }
  await locator.click({ timeout: step.timeout || 10000 });
}

async function focusCoordinates(step) {
  if (!hasCoordinates(step)) throw new Error("Coordinate typing needs numeric x and y");
  await page.mouse.click(step.x, step.y);
}

function resolveEnv(value) {
  const input = String(value ?? "");
  const pattern = new RegExp("\\{\\{env:([A-Z0-9_]+)\\}\\}", "g");
  return input.replace(pattern, (_, key) => {
    if (process.env[key] === undefined) throw new Error("Missing environment variable " + key + "; set it before replaying this workflow.");
    return process.env[key];
  });
}

async function typeValue(step) {
  const value = resolveEnv(step.value);
  if (hasCoordinates(step)) {
    await focusCoordinates(step);
    await page.keyboard.insertText(value);
    return;
  }
  const locator = getLocator(step);
  if (!locator) {
    throw new Error("type/fill needs selector, role + name, text/label/placeholder/testId, or numeric x/y coordinates");
  }
  if (step.action === "fill") {
    await locator.fill(value, { timeout: step.timeout || 10000 });
  } else {
    await locator.pressSequentially(value, { delay: step.delay ?? 35, timeout: step.timeout || 10000 });
  }
}

async function waitForText(step) {
  if (!step.text) throw new Error("waitForText needs a text value");
  await page.getByText(step.text, { exact: step.exact ?? false }).first()
    .waitFor({ state: step.state || "visible", timeout: step.timeout || 20000 });
}

async function waitForStableText(step) {
  const locator = getLocator(step);
  if (!locator) throw new Error("waitForStableText needs a selector, role/name, text, label, placeholder, or testId");
  const timeout = step.timeout || 30000;
  const stableMs = step.stableMs || 1800;
  const pollMs = step.pollMs || 250;
  await locator.waitFor({ state: "visible", timeout });
  const started = Date.now();
  let previous = null;
  let unchangedSince = Date.now();
  while (Date.now() - started < timeout) {
    const current = (await locator.innerText().catch(() => "")).trim();
    if (current && current === previous) {
      if (Date.now() - unchangedSince >= stableMs) return;
    } else {
      previous = current;
      unchangedSince = Date.now();
    }
    await page.waitForTimeout(pollMs);
  }
  throw new Error(`Text did not stabilize within ${timeout}ms`);
}

async function runStep(step, index) {
  const label = step.label || `${step.action} ${step.selector || step.text || step.value || ""}`.trim();
  console.log(`[${index + 1}/${config.steps.length}] ${label}`);

  switch (step.action) {
    case "goto":
      await page.goto(step.url || baseUrl, { waitUntil: step.waitUntil || "domcontentloaded", timeout: step.timeout || 30000 });
      break;
    case "click":
    case "clickAt":
      await clickTarget(step);
      break;
    case "fill":
    case "type":
    case "typeAt":
      await typeValue(step);
      break;
    case "upload": {
      if (!step.file) throw new Error("upload needs a file path");
      const filePath = path.resolve(step.file);
      await fs.access(filePath);
      if (step.trigger) {
        const chooserPromise = page.waitForEvent("filechooser", { timeout: step.timeout || 10000 });
        await clickTarget(step.trigger);
        const chooser = await chooserPromise;
        await chooser.setFiles(filePath);
      } else {
        const locator = getLocator(step);
        if (!locator) throw new Error("upload needs a selector for the file input, or a trigger target for a file chooser");
        await locator.setInputFiles(filePath, { timeout: step.timeout || 10000 });
      }
      break;
    }
    case "press": {
      if (hasCoordinates(step)) await focusCoordinates(step);
      else {
        const locator = getLocator(step);
        if (!locator) throw new Error("press needs a target locator or x/y coordinates");
        await locator.focus({ timeout: step.timeout || 10000 });
      }
      await page.keyboard.press(step.key || "Enter");
      break;
    }
    case "wait":
      await page.waitForTimeout(Math.min(Math.max(Number(step.ms) || 500, 0), 30000));
      break;
    case "waitForSelector": {
      const locator = getLocator(step);
      if (!locator) throw new Error("waitForSelector needs selector, role/name, text, label, placeholder, or testId");
      await locator.waitFor({ state: step.state || "visible", timeout: step.timeout || 15000 });
      break;
    }
    case "waitForText":
      await waitForText(step);
      break;
    case "waitForStableText":
      await waitForStableText(step);
      break;
    case "scroll":
      await page.evaluate(({ x, y }) => window.scrollTo({ left: x, top: y, behavior: "smooth" }), { x: step.x || 0, y: step.y || 0 });
      await page.waitForTimeout(450);
      break;
    case "screenshot":
      await page.screenshot({ path: path.resolve(outputDir, step.file || `step-${index + 1}.png`), fullPage: false });
      break;
    default:
      throw new Error(`Unknown action "${step.action}". Supported: goto, click/clickAt, fill, type/typeAt, upload, press, wait, waitForSelector, waitForText, waitForStableText, scroll, screenshot.`);
  }
  if (step.pauseAfter) await page.waitForTimeout(Math.min(Number(step.pauseAfter), 15000));
  completedSteps.push({ step: index + 1, label, action: step.action, status: "passed", completedAt: new Date().toISOString() });
}

try {
  console.log("\nCutlume Demo Replay — local prototype");
  console.log(`Target: ${baseUrl}`);
  console.log(`Steps: ${config.steps.length}`);
  console.log("Use a test account and avoid real payment or personal data.\n");

  browser = await chromium.launch({ headless, slowMo });
  context = await browser.newContext({
    viewport,
    recordVideo: { dir: outputDir, size: viewport },
  });
  page = await context.newPage();
  video = page.video();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

  for (let index = 0; index < config.steps.length; index += 1) {
    failedStep = index;
    await runStep(config.steps[index], index);
  }
  failedStep = null;
  console.log("\nWorkflow finished. Finalizing the screen recording...");
} catch (error) {
  failure = {
    message: error instanceof Error ? error.message : String(error),
    step: (failedStep ?? 0) + 1,
    label: config.steps[failedStep ?? 0]?.label || config.steps[failedStep ?? 0]?.action || "browser setup",
    occurredAt: new Date().toISOString(),
  };
  console.error(`\nReplay stopped at step ${failure.step}: ${failure.label}`);
  console.error(failure.message);
  process.exitCode = 1;
  if (page) {
    try {
      const screenshotPath = path.join(outputDir, `${safeName}-${stamp}-failure.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      failure.screenshot = screenshotPath;
      console.error(`Failure screenshot: ${screenshotPath}`);
    } catch (screenshotError) {
      failure.screenshotError = screenshotError instanceof Error ? screenshotError.message : String(screenshotError);
    }
  }
} finally {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
}

let recordingSaved = false;
let recordingError = null;
try {
  if (!video) throw new Error("No browser video was created.");
  await video.saveAs(outputPath);
  const saved = await fs.stat(outputPath);
  if (!saved.isFile() || saved.size === 0) throw new Error("Recording output exists but is empty.");
  recordingSaved = true;
} catch (error) {
  recordingError = error instanceof Error ? error.message : String(error);
  // Playwright normally finalizes through saveAs. If that copy fails, attempt a
  // direct copy from Playwright's finalized source video before declaring failure.
  try {
    if (!video) throw new Error("No browser video was created.");
    const sourcePath = await video.path();
    const source = await fs.stat(sourcePath);
    if (!source.isFile() || source.size === 0) throw new Error("Playwright's source recording is empty.");
    await fs.copyFile(sourcePath, outputPath);
    const saved = await fs.stat(outputPath);
    if (!saved.isFile() || saved.size === 0) throw new Error("Fallback recording copy is empty.");
    recordingSaved = true;
    console.warn("Recording saved using the fallback copy after saveAs failed.");
  } catch (fallbackError) {
    const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
    failure ||= {
      message: `saveAs failed: ${recordingError}; fallback copy failed: ${fallbackMessage}`,
      step: (failedStep ?? config.steps.length - 1) + 1,
      label: "finalize recording",
      occurredAt: new Date().toISOString(),
    };
    console.error("Could not finalize the recording:", failure.message);
    process.exitCode = 1;
  }
}
if (recordingSaved) console.log(`Recording saved: ${outputPath}`);

let mp4Path = null;
let mp4Status = "not-created";
if (recordingSaved && shouldConvertMp4) {
  const ffmpegCheck = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (!ffmpegCheck.error && ffmpegCheck.status === 0) {
    mp4Path = outputPath.replace(/\.webm$/i, ".mp4");
    const conversion = spawnSync("ffmpeg", [
      "-y", "-i", outputPath, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", mp4Path,
    ], { encoding: "utf8" });
    let validMp4 = false;
    if (conversion.status === 0) {
      try {
        const output = await fs.stat(mp4Path);
        validMp4 = output.isFile() && output.size > 0;
      } catch {
        validMp4 = false;
      }
    }
    if (validMp4) {
      mp4Status = "created";
      console.log(`MP4 saved: ${mp4Path}`);
    } else {
      mp4Path = null;
      mp4Status = "conversion-failed";
      console.warn("MP4 conversion failed or produced an empty file; the WebM recording is still available.");
      console.warn((conversion.stderr || "").slice(-1200));
    }
  } else {
    mp4Status = "ffmpeg-not-installed";
    console.log("MP4 not created: FFmpeg is not installed. The WebM recording is saved.");
    console.log("Install FFmpeg and rerun to get an MP4 automatically, or use --no-mp4 to skip this check.");
  }
}

const report = {
  name: config.name || "cutlume-demo",
  targetUrl: baseUrl,
  startedAt: stamp,
  finishedAt: new Date().toISOString(),
  status: failure ? "failed" : "passed",
  totalSteps: config.steps.length,
  completedSteps,
  failure,
  recording: recordingSaved ? outputPath : null,
  mp4: mp4Path,
  mp4Status,
};
try {
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Run report saved: ${reportPath}`);
} catch (error) {
  console.error("Could not write the run report:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

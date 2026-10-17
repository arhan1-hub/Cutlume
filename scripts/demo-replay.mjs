#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const configPath = path.resolve(arg("--config", "demo-flow.json"));
const urlOverride = arg("--url");
const headless = process.argv.includes("--headless");
const slowMo = Number(arg("--slow-mo", "120"));

let config;
try {
  config = JSON.parse(await fs.readFile(configPath, "utf8"));
} catch (error) {
  console.error(`Could not read ${configPath}. Copy demo-flow.example.json to demo-flow.json and edit it first.`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const baseUrl = urlOverride || config.baseUrl;
if (!baseUrl) {
  console.error("Set baseUrl in the config or pass --url http://localhost:3000");
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
const viewport = config.viewport || { width: 1440, height: 900 };
const browser = await chromium.launch({ headless, slowMo });
const context = await browser.newContext({
  viewport,
  recordVideo: { dir: outputDir, size: viewport },
});
const page = await context.newPage();
const video = page.video();
let failedStep = null;

async function runStep(step, index) {
  const label = step.label || `${step.action} ${step.selector || step.value || ""}`.trim();
  console.log(`[${index + 1}/${config.steps.length}] ${label}`);
  const locator = step.selector ? page.locator(step.selector).first() : null;

  switch (step.action) {
    case "goto":
      await page.goto(step.url || baseUrl, { waitUntil: step.waitUntil || "domcontentloaded" });
      break;
    case "click":
      if (!locator) throw new Error("click needs selector");
      await locator.click({ timeout: step.timeout || 10000 });
      break;
    case "fill":
      if (!locator) throw new Error("fill needs selector");
      await locator.fill(String(step.value ?? ""), { timeout: step.timeout || 10000 });
      break;
    case "type":
      if (!locator) throw new Error("type needs selector");
      await locator.pressSequentially(String(step.value ?? ""), { delay: step.delay ?? 35, timeout: step.timeout || 10000 });
      break;
    case "press":
      if (!locator) throw new Error("press needs selector");
      await locator.press(String(step.key || "Enter"), { timeout: step.timeout || 10000 });
      break;
    case "wait":
      await page.waitForTimeout(Math.min(Math.max(Number(step.ms) || 500, 0), 15000));
      break;
    case "waitForSelector":
      if (!locator) throw new Error("waitForSelector needs selector");
      await locator.waitFor({ state: step.state || "visible", timeout: step.timeout || 15000 });
      break;
    case "scroll":
      await page.evaluate(({ x, y }) => window.scrollTo({ left: x, top: y, behavior: "smooth" }), { x: step.x || 0, y: step.y || 0 });
      await page.waitForTimeout(450);
      break;
    case "screenshot":
      await page.screenshot({ path: path.resolve(outputDir, step.file || `step-${index + 1}.png`), fullPage: false });
      break;
    default:
      throw new Error(`Unknown action "${step.action}". Supported: goto, click, fill, type, press, wait, waitForSelector, scroll, screenshot.`);
  }
  if (step.pauseAfter) await page.waitForTimeout(Math.min(Number(step.pauseAfter), 10000));
}

try {
  console.log("\nCutlume Demo Replay — local prototype");
  console.log(`Target: ${baseUrl}`);
  console.log(`Steps: ${config.steps.length}`);
  console.log("A browser window will open. Use a test account and avoid real payment or personal data.\n");
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  for (let index = 0; index < config.steps.length; index += 1) {
    failedStep = index;
    await runStep(config.steps[index], index);
  }
  failedStep = null;
  console.log("\nWorkflow finished. Finalizing the screen recording...");
} catch (error) {
  console.error(`\nReplay stopped at step ${(failedStep ?? 0) + 1}. The recording may be incomplete.`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}

try {
  if (!video) throw new Error("The browser did not create a video recording.");
  await video.saveAs(outputPath);
  console.log(`Recording saved: ${outputPath}`);
  console.log("Format: WebM (not MP4 yet). The workflow can be replayed again against the next build.");
} catch (error) {
  console.error("Could not finalize the recording:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

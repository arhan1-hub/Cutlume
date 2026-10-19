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
const presentationScreenshots = [];
let endCardResult = null;

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

async function applyPresentation(step, index) {
  await page.evaluate(() => document.querySelector("#cutlume-recording-overlay")?.remove());
  if (!step.caption && !step.effect) return;

  let targetBox = null;
  if (step.effect === "spotlight") {
    if (hasCoordinates(step)) {
      targetBox = { x: step.x - 24, y: step.y - 24, width: 48, height: 48 };
    } else {
      const locator = getLocator(step);
      if (locator) {
        // Match Playwright's later click behavior: bring off-screen targets into view
        // before positioning the spotlight and capturing its presentation frame.
        await locator.scrollIntoViewIfNeeded({ timeout: step.timeout || 10000 });
        targetBox = await locator.boundingBox();
        if (!targetBox) throw new Error(`Spotlight target is not visible: ${step.selector || step.text || step.label || step.role || "target"}`);
      }
    }
  }

  await page.evaluate(({ caption, effect, targetBox, index, accent }) => {
    const root = document.createElement("div");
    root.id = "cutlume-recording-overlay";
    root.setAttribute("aria-hidden", "true");
    Object.assign(root.style, {
      position: "fixed", inset: "0", zIndex: "2147483647",
      pointerEvents: "none", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    });

    const style = document.createElement("style");
    style.textContent = `
      @keyframes cutlumeCaptionIn { from { opacity: 0; transform: translate(-50%, 14px); } to { opacity: 1; transform: translate(-50%, 0); } }
      @keyframes cutlumeSpotPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.12), 0 0 0 3px ${accent}; } 50% { box-shadow: 0 0 0 10px rgba(255,255,255,.06), 0 0 0 3px ${accent}; } }
      #cutlume-recording-overlay::before { content: ""; position: absolute; inset: 48% 0 0; background: linear-gradient(180deg, transparent 0%, rgba(5,7,15,.22) 24%, rgba(5,7,15,.82) 100%); }
      #cutlume-caption { position: absolute; left: 50%; bottom: clamp(34px, 7vh, 76px); transform: translateX(-50%); width: max-content; max-width: min(86vw, 1040px); padding: clamp(20px, 2.8vw, 34px) clamp(24px, 4vw, 52px); border: 1px solid rgba(255,255,255,.2); border-radius: 24px; background: linear-gradient(135deg, rgba(18,20,36,.94), rgba(21,17,42,.88)); color: white; font-size: clamp(25px, 3.1vw, 42px); font-weight: 780; letter-spacing: -.045em; line-height: 1.12; text-align: center; text-wrap: balance; box-shadow: 0 24px 90px rgba(0,0,0,.48), 0 0 0 1px rgba(167,139,250,.08) inset; backdrop-filter: blur(18px); animation: cutlumeCaptionIn .38s cubic-bezier(.2,.8,.2,1) both; }
      #cutlume-caption::before { content: "CUTLUME  /  PRODUCT DEMO"; display: block; margin-bottom: 12px; color: #c4b5fd; font-size: clamp(10px, 1vw, 13px); font-weight: 850; letter-spacing: .19em; line-height: 1.2; }
      #cutlume-spotlight { position: absolute; border: 2px solid ${accent}; border-radius: 12px; background: rgba(255,255,255,.025); animation: cutlumeSpotPulse 1.25s ease-in-out infinite; }
    `;
    root.appendChild(style);
    if (caption) {
      const label = document.createElement("div");
      label.id = "cutlume-caption";
      label.textContent = caption;
      // Keep the caption away from spotlight targets near the bottom of the viewport.
      const captionAtTop = Boolean(targetBox && targetBox.y > window.innerHeight * 0.5);
      label.style.top = captionAtTop ? "clamp(34px, 7vh, 76px)" : "auto";
      label.style.bottom = captionAtTop ? "auto" : "clamp(34px, 7vh, 76px)";
      root.appendChild(label);
    }
    if (effect === "spotlight" && targetBox) {
      const ring = document.createElement("div");
      ring.id = "cutlume-spotlight";
      Object.assign(ring.style, {
        left: Math.max(0, targetBox.x - 6) + "px",
        top: Math.max(0, targetBox.y - 6) + "px",
        width: Math.max(48, targetBox.width + 12) + "px",
        height: Math.max(48, targetBox.height + 12) + "px"
      });
      root.appendChild(ring);
    }
    document.documentElement.appendChild(root);
  }, {
    caption: step.caption || "",
    effect: step.effect || "",
    targetBox,
    index,
    accent: config.recordingStyle?.accentColor || "#8b5cf6"
  });
}

async function showEndCard() {
  const endCard = config.endCard;
  if (!endCard?.enabled || failure || !page) return null;

  const durationMs = Math.min(Math.max(Number(endCard.durationMs) || 3500, 1800), 10000);
  const copy = {
    brand: endCard.brand || "CUTLUME",
    headline: endCard.headline || "Your product evolves. Your demo keeps up.",
    subheadline: endCard.subheadline || "Replay your workflow. Capture a fresh demo. Share it.",
    cta: endCard.cta || "Make your next demo with Cutlume",
    accent: config.recordingStyle?.accentColor || "#a78bfa"
  };

  await page.evaluate(({ brand, headline, subheadline, cta, accent }) => {
    document.querySelector("#cutlume-recording-overlay")?.remove();
    const root = document.createElement("div");
    root.id = "cutlume-end-card";
    root.setAttribute("aria-hidden", "true");
    Object.assign(root.style, {
      position: "fixed", inset: "0", zIndex: "2147483647", overflow: "hidden",
      display: "grid", placeItems: "center", padding: "36px",
      pointerEvents: "none", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      color: "#fff", background: "radial-gradient(ellipse at 18% 10%, rgba(124,92,246,.38), transparent 45%), radial-gradient(ellipse at 85% 90%, rgba(34,211,238,.2), transparent 38%), linear-gradient(135deg,#090b14 0%,#121327 52%,#090d17 100%)"
    });
    const style = document.createElement("style");
    style.textContent = `
      @keyframes cutlumeEndIn { from { opacity: 0; transform: translateY(22px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes cutlumeEndGlow { 0%,100% { opacity:.42; transform:scale(.96); } 50% { opacity:.8; transform:scale(1.06); } }
      #cutlume-end-card .glow { position:absolute; width:min(70vw,760px); aspect-ratio:1; border-radius:50%; background:radial-gradient(circle, ${accent}30 0%, transparent 68%); filter:blur(12px); animation:cutlumeEndGlow 5s ease-in-out infinite; }
      #cutlume-end-card .content { position:relative; width:min(100%,920px); text-align:center; animation:cutlumeEndIn .7s cubic-bezier(.2,.8,.2,1) both; }
      #cutlume-end-card .brand { display:inline-flex; align-items:center; gap:12px; margin-bottom:clamp(28px,5vh,52px); color:#f8f7ff; font-size:clamp(15px,1.8vw,21px); font-weight:900; letter-spacing:.16em; }
      #cutlume-end-card .logo { display:grid; place-items:center; width:clamp(42px,5vw,58px); height:clamp(42px,5vw,58px); border-radius:18px; color:#10111b; font-size:clamp(22px,2.8vw,31px); letter-spacing:-.08em; background:linear-gradient(135deg,#c4b5fd,#67e8f9); box-shadow:0 8px 38px ${accent}45; }
      #cutlume-end-card .eyebrow { color:#c4b5fd; font-size:clamp(10px,1.1vw,13px); font-weight:850; letter-spacing:.22em; text-transform:uppercase; margin-bottom:20px; }
      #cutlume-end-card h1 { margin:0 auto; max-width:850px; font-size:clamp(34px,6vw,76px); line-height:.99; letter-spacing:-.065em; font-weight:850; text-wrap:balance; }
      #cutlume-end-card .gradient { color:transparent; background:linear-gradient(100deg,#c4b5fd 10%,#fff 48%,#67e8f9 90%); -webkit-background-clip:text; background-clip:text; }
      #cutlume-end-card .sub { max-width:650px; margin:26px auto 0; color:#b8bfd4; font-size:clamp(15px,1.8vw,21px); line-height:1.5; text-wrap:balance; }
      #cutlume-end-card .cta { display:inline-flex; align-items:center; gap:12px; margin-top:clamp(28px,5vh,48px); padding:16px 24px; border:1px solid rgba(255,255,255,.24); border-radius:15px; color:#10111b; background:linear-gradient(110deg,#c4b5fd,#67e8f9); font-size:clamp(13px,1.35vw,16px); font-weight:850; box-shadow:0 12px 42px ${accent}35; }
      #cutlume-end-card .foot { position:absolute; left:20px; right:20px; bottom:20px; display:flex; justify-content:space-between; gap:16px; color:#727b99; font-size:clamp(9px,.9vw,11px); letter-spacing:.12em; text-transform:uppercase; }
      @media(max-width:600px) { #cutlume-end-card .foot { justify-content:center; } #cutlume-end-card .foot span:last-child { display:none; } }
    `;
    root.appendChild(style);
    const glow = document.createElement("div");
    glow.className = "glow";
    root.appendChild(glow);
    const content = document.createElement("div");
    content.className = "content";
    const brandRow = document.createElement("div");
    brandRow.className = "brand";
    const logo = document.createElement("span");
    logo.className = "logo";
    logo.textContent = "C";
    const brandName = document.createElement("span");
    brandName.textContent = brand;
    brandRow.append(logo, brandName);
    const eyebrow = document.createElement("div");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "A fresh demo, ready to share";
    const heading = document.createElement("h1");
    heading.append(document.createTextNode(headline + " "));
    const highlight = document.createElement("span");
    highlight.className = "gradient";
    highlight.textContent = "keeps up.";
    if (headline.toLowerCase().includes("keeps up")) {
      heading.textContent = headline.replace(/\s*keeps up\.?$/i, "");
      heading.append(document.createTextNode(" "));
      heading.append(highlight);
    } else {
      heading.textContent = headline;
    }
    const sub = document.createElement("p");
    sub.className = "sub";
    sub.textContent = subheadline;
    const button = document.createElement("div");
    button.className = "cta";
    button.textContent = cta + "  ↗";
    content.append(brandRow, eyebrow, heading, sub, button);
    const foot = document.createElement("div");
    foot.className = "foot";
    const left = document.createElement("span");
    left.textContent = "CUTLUME  ·  REPLAY. REFRESH. SHARE.";
    const right = document.createElement("span");
    right.textContent = "YOUR WORKFLOW, ON REPEAT";
    foot.append(left, right);
    root.append(content, foot);
    document.documentElement.appendChild(root);
  }, copy);

  const screenshotPath = path.join(outputDir, `${safeName}-${stamp}-end-card.png`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
  await page.waitForTimeout(durationMs);
  await page.evaluate(() => document.querySelector("#cutlume-end-card")?.remove());
  console.log(`Branded end card shown for ${durationMs}ms.`);
  return { status: "shown", durationMs, screenshot: screenshotPath, headline: copy.headline };
}

async function runStep(step, index) {
  const label = step.label || `${step.action} ${step.selector || step.text || step.value || ""}`.trim();
  console.log(`[${index + 1}/${config.steps.length}] ${label}`);
  await applyPresentation(step, index);

  if (config.capturePresentationScreenshots && (step.caption || step.effect)) {
    const screenshotPath = path.join(outputDir, `${safeName}-${stamp}-step-${String(index + 1).padStart(2, "0")}-presentation.png`);
    try {
      // Let the caption entrance animation finish before inspecting or capturing it.
      await page.waitForTimeout(500);
      const overlayState = await page.evaluate(() => {
        const caption = document.querySelector("#cutlume-caption");
        const spotlight = document.querySelector("#cutlume-spotlight");
        const visible = (element) => {
          if (!element) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" &&
            Number(style.opacity) >= 0.95 && rect.width > 0 && rect.height > 0 &&
            rect.bottom > 0 && rect.right > 0 &&
            rect.top < window.innerHeight && rect.left < window.innerWidth;
        };
        return {
          caption: caption?.textContent || null,
          captionVisible: visible(caption),
          captionOpacity: caption ? getComputedStyle(caption).opacity : null,
          spotlightVisible: visible(spotlight),
          spotlightRect: spotlight ? (() => {
            const rect = spotlight.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          })() : null,
        };
      });
      await page.screenshot({ path: screenshotPath, fullPage: false });
      presentationScreenshots.push({
        step: index + 1,
        label,
        effect: step.effect || null,
        path: screenshotPath,
        captionVisible: overlayState.captionVisible,
        captionText: overlayState.caption,
        captionOpacity: overlayState.captionOpacity,
        spotlightVisible: overlayState.spotlightVisible,
        spotlightRect: overlayState.spotlightRect,
      });
    } catch (error) {
      presentationScreenshots.push({
        step: index + 1,
        label,
        path: null,
        error: error instanceof Error ? error.message : String(error),
        captionVisible: false,
        spotlightVisible: false,
      });
    }
  }

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
  const presentationHoldMs = Number(step.presentationMs ?? (step.caption || step.effect ? 1600 : 0));
  if (presentationHoldMs > 0) await page.waitForTimeout(Math.min(Math.max(presentationHoldMs, 0), 10000));
  await page.evaluate(() => document.querySelector("#cutlume-recording-overlay")?.remove());
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
  if (process.env.CUTLUME_REPLAY_ENFORCE_HOST_ALLOWLIST === "1") {
    const allowedHosts = (process.env.CUTLUME_REPLAY_ALLOWED_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
    await page.route("**/*", async (route) => {
      try {
        const requestUrl = new URL(route.request().url());
        const host = requestUrl.hostname.toLowerCase();
        const allowed = allowedHosts.some((item) => host === item || host.endsWith("." + item));
        if (!allowed || requestUrl.protocol !== "https:" && requestUrl.protocol !== "http:") {
          await route.abort("blockedbyclient");
          return;
        }
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });
  }
  video = page.video();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

  for (let index = 0; index < config.steps.length; index += 1) {
    failedStep = index;
    await runStep(config.steps[index], index);
  }
  endCardResult = await showEndCard();
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
  presentationScreenshots,
  failure,
  recording: recordingSaved ? outputPath : null,
  mp4: mp4Path,
  mp4Status,
  endCard: endCardResult,
};
try {
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Run report saved: ${reportPath}`);
} catch (error) {
  console.error("Could not write the run report:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

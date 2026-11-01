"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Download,
  FileJson,
  LockKeyhole,
  Plus,
  Sparkles,
  Trash2,
  Video,
  Workflow,
} from "lucide-react";

type ReplayAction =
  | "waitForSelector"
  | "click"
  | "fill"
  | "press"
  | "waitForText"
  | "waitForStableText"
  | "wait"
  | "upload"
  | "screenshot";

type ReplayStep = {
  id: string;
  action: ReplayAction;
  label: string;
  selector: string;
  value: string;
  caption: string;
  effect: boolean;
  role?: string;
  name?: string;
  placeholder?: string;
  testId?: string;
  locatorLabel?: string;
  locatorText?: string;
  exact?: boolean;
};

const starterSteps: ReplayStep[] = [
  {
    id: "load",
    action: "waitForSelector",
    label: "Wait for the app workspace",
    selector: "body",
    value: "",
    caption: "Start with the product, not a blank timeline.",
    effect: false,
  },
  {
    id: "prompt",
    action: "fill",
    label: "Enter a prompt",
    selector: "[data-testid='prompt-input']",
    value: "Show me what this product can do",
    caption: "One workflow. A clear story.",
    effect: false,
  },
  {
    id: "generate",
    action: "click",
    label: "Generate the answer",
    selector: "[data-testid='send-prompt']",
    value: "",
    caption: "Capture the moment the product responds.",
    effect: true,
  },
  {
    id: "response",
    action: "waitForStableText",
    label: "Wait for the response to finish",
    selector: "[data-testid='assistant-response']",
    value: "",
    caption: "Let the full answer land before moving on.",
    effect: false,
  },
  {
    id: "upgrade",
    action: "click",
    label: "Open the upgrade screen",
    selector: "[data-testid='upgrade-button']",
    value: "",
    caption: "Finish on the next step.",
    effect: true,
  },
];

const actionLabels: Record<ReplayAction, string> = {
  waitForSelector: "Wait for element",
  click: "Click",
  fill: "Fill text field",
  press: "Press a key",
  waitForText: "Wait for text",
  waitForStableText: "Wait for stable text",
  wait: "Pause",
  upload: "Attach sample image",
  screenshot: "Take screenshot",
};

function makeId() {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function DemoReplayPage() {
  const [projectName, setProjectName] = useState("My product demo");
  const [baseUrl, setBaseUrl] = useState("");
  const [steps, setSteps] = useState<ReplayStep[]>(starterSteps);
  const [downloaded, setDownloaded] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("");
  const [jobMessage, setJobMessage] = useState<string>("");
  const [jobError, setJobError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [workerConfigured, setWorkerConfigured] = useState(false);
  const [accentColor, setAccentColor] = useState("#f47745");
  const [captionFont, setCaptionFont] = useState("Inter, ui-sans-serif, system-ui, sans-serif");
  const [captionScale, setCaptionScale] = useState(100);
  const [captionPosition, setCaptionPosition] = useState("auto");
  const [brandName, setBrandName] = useState("CUTLUME");
  const [endHeadline, setEndHeadline] = useState("Your product evolves. Your demo keeps up.");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/replay", { cache: "no-store" }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!cancelled) setWorkerConfigured(Boolean(data.configured));
    }).catch(() => { if (!cancelled) setWorkerConfigured(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!jobId || !["queued", "running"].includes(jobStatus)) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/replay/${jobId}`, { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || "Could not check replay status.");
        setJobStatus(data.status || "running");
        setJobMessage(data.progress?.message || (data.status === "completed" ? "Your recording is ready." : "Replay is running."));
        if (data.status === "failed") setJobError(data.error || data.report?.failure?.message || "Replay failed. Edit the workflow and try again.");
      } catch (error) {
        if (!cancelled) setJobError(error instanceof Error ? error.message : "Could not check replay status.");
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [jobId, jobStatus]);


  const validUrl = useMemo(() => {
    try {
      const parsed = new URL(baseUrl.trim());
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }, [baseUrl]);

  const config = useMemo(() => ({
    name: projectName.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-") || "cutlume-demo",
    baseUrl: baseUrl.trim(),
    outputDir: "recordings",
    viewport: { width: 1280, height: 800 },
    recordingStyle: { accentColor, captionFont, captionScale: captionScale / 100, captionPosition },
    steps: steps.map((step) => {
      const common = {
        action: step.action,
        label: step.label,
        caption: step.caption,
        ...(step.effect ? { effect: "spotlight" } : {}),
        ...(step.selector ? { selector: step.selector } : {}),
        ...(step.role ? { role: step.role } : {}),
        ...(step.name ? { name: step.name } : {}),
        ...(step.placeholder ? { placeholder: step.placeholder } : {}),
        ...(step.testId ? { testId: step.testId } : {}),
        ...(step.locatorLabel ? { locatorLabel: step.locatorLabel } : {}),
        ...(step.locatorText && step.action !== "waitForText" ? { text: step.locatorText } : {}),
        ...(typeof step.exact === "boolean" ? { exact: step.exact } : {}),
      };
      const locatorConfig = {
        ...(step.selector ? { selector: step.selector } : {}),
        ...(step.role ? { role: step.role } : {}),
        ...(step.name ? { name: step.name } : {}),
        ...(step.placeholder ? { placeholder: step.placeholder } : {}),
        ...(step.testId ? { testId: step.testId } : {}),
        ...(step.locatorLabel ? { locatorLabel: step.locatorLabel } : {}),
        ...(step.locatorText ? { text: step.locatorText } : {}),
        ...(typeof step.exact === "boolean" ? { exact: step.exact } : {}),
      };
      if (step.action === "upload") {
        return { ...common, file: "./fixtures/demo-image.svg", trigger: locatorConfig, presentationMs: 900 };
      }
      if (step.action === "fill") {
        return { ...common, value: step.value, presentationMs: 1500 };
      }
      if (step.action === "press") {
        return { ...common, key: step.value || "Enter", presentationMs: 900 };
      }
      if (step.action === "waitForText") {
        return { ...common, text: step.value, timeout: 20000 };
      }
      if (step.action === "waitForStableText") {
        return { ...common, stableMs: 1200, timeout: 20000 };
      }
      if (step.action === "wait") {
        return { ...common, ms: Number(step.value) || 800 };
      }
      if (step.action === "screenshot") {
        return { ...common, file: `${step.id}.png` };
      }
      return { ...common, ...(step.action === "waitForSelector" ? { timeout: 15000 } : {}) };
    }),
    endCard: {
      enabled: true,
      durationMs: 3500,
      brand: brandName.trim() || "YOUR BRAND",
      headline: endHeadline.trim() || "Your product evolves. Your demo keeps up.",
      subheadline: "Replay your workflow. Capture a fresh demo. Share it.",
      cta: "Make your next demo with Cutlume",
    },
  }), [projectName, baseUrl, steps, accentColor, captionFont, captionScale, captionPosition, brandName, endHeadline]);

  function updateStep(id: string, patch: Partial<ReplayStep>) {
    setDownloaded(false);
    setSteps((current) => current.map((step) => step.id === id ? { ...step, ...patch } : step));
  }

  function addStep() {
    setDownloaded(false);
    setSteps((current) => [...current, {
      id: makeId(),
      action: "click",
      label: "New workflow step",
      selector: "",
      value: "",
      caption: "",
      effect: false,
    }]);
  }

  function removeStep(id: string) {
    setDownloaded(false);
    setSteps((current) => current.filter((step) => step.id !== id));
  }

  function moveStep(id: string, direction: -1 | 1) {
    setDownloaded(false);
    setSteps((current) => {
      const index = current.findIndex((step) => step.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function startReplay() {
    if (!validUrl || steps.length === 0 || submitting) return;
    setSubmitting(true);
    setJobId(null);
    setJobStatus("submitting");
    setJobMessage("Sending workflow to the replay worker…");
    setJobError("");
    try {
      const response = await fetch("/api/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Replay could not be started.");
      if (!data.id) throw new Error("Worker did not return a job ID.");
      setJobId(data.id);
      setJobStatus(data.status || "queued");
      setJobMessage("Replay queued. Your video will appear here when it finishes.");
    } catch (error) {
      setJobStatus("failed");
      setJobError(error instanceof Error ? error.message : "Replay could not be started.");
    } finally {
      setSubmitting(false);
    }
  }

  function importWorkflow(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "")) as Record<string, unknown>;
        const allowedActions = new Set<ReplayAction>([
          "waitForSelector", "click", "fill", "press", "waitForText",
          "waitForStableText", "wait", "upload", "screenshot",
        ]);
        if (typeof parsed.baseUrl !== "string" || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
          throw new Error("This file doesn’t look like a Cutlume workflow. Choose a demo-flow.json exported from Cutlume.");
        }
        const importedSteps: ReplayStep[] = parsed.steps.map((rawStep, index) => {
          if (!rawStep || typeof rawStep !== "object") throw new Error("One workflow step is invalid.");
          const step = rawStep as Record<string, unknown>;
          if (typeof step.action !== "string" || !allowedActions.has(step.action as ReplayAction)) {
            throw new Error(`Step ${index + 1} uses an unsupported action.`);
          }
          const trigger = step.trigger && typeof step.trigger === "object" && !Array.isArray(step.trigger)
            ? step.trigger as Record<string, unknown>
            : {};
          const locatorSource = step.action === "upload" ? trigger : step;
          return {
            id: makeId(),
            action: step.action as ReplayAction,
            label: typeof step.label === "string" ? step.label : `Step ${index + 1}`,
            selector: typeof locatorSource.selector === "string" ? locatorSource.selector : "",
            value: typeof step.value === "string" ? step.value : typeof step.key === "string" ? step.key : typeof step.ms === "number" ? String(step.ms) : step.action === "waitForText" && typeof step.text === "string" ? step.text : "",
            caption: typeof step.caption === "string" ? step.caption : "",
            effect: step.effect === "spotlight" || step.effect === true,
            ...(typeof locatorSource.role === "string" ? { role: locatorSource.role } : {}),
            ...(typeof locatorSource.name === "string" ? { name: locatorSource.name } : {}),
            ...(typeof locatorSource.placeholder === "string" ? { placeholder: locatorSource.placeholder } : {}),
            ...(typeof locatorSource.testId === "string" ? { testId: locatorSource.testId } : {}),
            ...(typeof locatorSource.locatorLabel === "string" ? { locatorLabel: locatorSource.locatorLabel } : typeof locatorSource.label === "string" && step.action === "upload" ? { locatorLabel: locatorSource.label } : {}),
            ...(typeof locatorSource.text === "string" && step.action !== "waitForText" ? { locatorText: locatorSource.text } : {}),
            ...(typeof locatorSource.exact === "boolean" ? { exact: locatorSource.exact } : {}),
          };
        });
        const style = parsed.recordingStyle && typeof parsed.recordingStyle === "object"
          ? parsed.recordingStyle as Record<string, unknown>
          : {};
        const endCard = parsed.endCard && typeof parsed.endCard === "object"
          ? parsed.endCard as Record<string, unknown>
          : {};
        setProjectName(typeof parsed.name === "string" ? parsed.name.replace(/-/g, " ") : "Imported product demo");
        setBaseUrl(parsed.baseUrl);
        setSteps(importedSteps);
        if (typeof style.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(style.accentColor)) setAccentColor(style.accentColor);
        if (typeof style.captionFont === "string" && ["Inter, ui-sans-serif, system-ui, sans-serif", "Arial, Helvetica, sans-serif", "Georgia, serif"].includes(style.captionFont)) setCaptionFont(style.captionFont);
        if (typeof style.captionScale === "number") setCaptionScale(Math.max(80, Math.min(120, Math.round(style.captionScale * 100))));
        if (typeof style.captionPosition === "string" && ["auto", "top", "bottom"].includes(style.captionPosition)) setCaptionPosition(style.captionPosition);
        if (typeof endCard.brand === "string") setBrandName(endCard.brand);
        if (typeof endCard.headline === "string") setEndHeadline(endCard.headline);
        setDownloaded(false);
        setJobId(null);
        setJobStatus("");
        setJobMessage("");
        setJobError("");
      } catch (error) {
        setJobError(error instanceof Error ? error.message : "Could not import that workflow file.");
        setJobStatus("failed");
      }
    };
    reader.onerror = () => {
      setJobError("Could not read that file. Try exporting a fresh demo-flow.json from Cutlume.");
      setJobStatus("failed");
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function downloadWorkflow() {
    if (!validUrl || steps.length === 0) return;
    const blob = new Blob([JSON.stringify(config, null, 2) + "\n"], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "demo-flow.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setDownloaded(true);
  }

  return (
    <main className="app-root replay-root">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar replay-topbar">
        <Link className="brand replay-brand" href="/" aria-label="Cutlume home">
          <span className="brand-mark"><Clapperboard size={19} strokeWidth={2.2} /></span>
          <span>cutlume<span className="brand-period">.</span></span>
        </Link>
        <nav className="top-nav replay-nav" aria-label="Main navigation">
          <Link href="/">Launch studio</Link>
          <Link href="/motion">Motion library</Link>
          <span className="replay-nav-active">Demo replay</span>
        </nav>
        <div className="top-actions">
          <span className="beta-label"><span className="status-dot" /> Prototype</span>
        </div>
      </header>

      <div className="replay-page">
        <Link href="/" className="replay-back"><ArrowLeft size={14} /> Back to Cutlume</Link>

        <section className="replay-hero">
          <div className="replay-hero-copy">
            <div className="eyebrow"><Workflow size={14} /> THE REPLAY WORKSPACE</div>
            <h1>Your product changes.<br /><span className="gradient-text">Your demo catches up.</span></h1>
            <p>Describe the browser steps once. Keep the captions and visual emphasis with the workflow. When the replay service is connected, Cutlume can turn the recipe into a fresh recording.</p>
            <div className="replay-hero-pills">
              <span><Check size={13} /> Reusable workflow</span>
              <span><Check size={13} /> Captions & spotlights</span>
              <span><Check size={13} /> Branded end card</span>
            </div>
          </div>
          <div className="replay-hero-art" aria-label="Illustration of a browser workflow becoming a recorded video">
            <div className="replay-art-orbit orbit-one" />
            <div className="replay-art-orbit orbit-two" />
            <div className="replay-art-window">
              <div className="replay-art-window-top"><i /><i /><i /><span>workflow.run</span></div>
              <div className="replay-art-row"><b>01</b><span>Open your product</span><Check size={14} /></div>
              <div className="replay-art-row"><b>02</b><span>Capture the key moment</span><Check size={14} /></div>
              <div className="replay-art-row"><b>03</b><span>Apply the story layer</span><Sparkles size={14} /></div>
              <div className="replay-art-progress"><i /></div>
            </div>
            <div className="replay-art-video"><Video size={19} /><span>FRESH DEMO</span><b>MP4</b></div>
            <div className="replay-art-caption">YOUR WORKFLOW, ON REPEAT ↗</div>
          </div>
        </section>

        <section className="replay-builder">
          <div className="replay-builder-heading">
            <div>
              <div className="eyebrow">WORKFLOW BUILDER / 01</div>
              <h2>Set up your replay.</h2>
              <p>Start with the test app URL and edit the sample steps to match its controls.</p>
            </div>
            <div className="replay-step-count"><Workflow size={15} /> {steps.length} steps</div>
          </div>

          <div className="replay-builder-grid">
            <div className="replay-config panel">
              <div className="replay-section-title"><span className="replay-section-icon"><Clapperboard size={17} /></span><div><strong>Demo details</strong><small>Where the replay should start</small></div></div>
              <label className="field-label" htmlFor="replay-project-name">DEMO NAME</label>
              <input id="replay-project-name" className="text-input" value={projectName} onChange={(event) => { setProjectName(event.target.value); setDownloaded(false); }} placeholder="e.g. AI workspace walkthrough" />
              <label className="field-label" htmlFor="replay-base-url">TEST APP URL</label>
              <input id="replay-base-url" className="text-input" value={baseUrl} onChange={(event) => { setBaseUrl(event.target.value); setDownloaded(false); }} placeholder="https://your-test-app.example" inputMode="url" />
              <p className={baseUrl && !validUrl ? "replay-field-hint replay-field-error" : "replay-field-hint"}>{baseUrl && !validUrl ? "Enter a complete http:// or https:// URL." : "Use a separate test deployment with dummy data. Avoid production accounts and real payments."}</p>

              <div className="replay-config-divider" />
              <div className="replay-section-title"><span className="replay-section-icon"><Sparkles size={17} /></span><div><strong>Recording style</strong><small>Applied to the exported workflow</small></div></div>
              <div className="replay-style-controls">
                <label className="field-label" htmlFor="replay-accent">ACCENT COLOUR</label>
                <div className="replay-colour-options" role="group" aria-label="Recording accent colour">
                  {[{name:"Warm orange",value:"#f47745"},{name:"Electric blue",value:"#5577ee"},{name:"Violet",value:"#8964df"},{name:"Emerald",value:"#23866d"}].map((colour) => (
                    <button key={colour.value} type="button" className={accentColor === colour.value ? "replay-colour-swatch is-selected" : "replay-colour-swatch"} style={{backgroundColor:colour.value}} onClick={() => setAccentColor(colour.value)} aria-label={colour.name} aria-pressed={accentColor === colour.value} title={colour.name}><span>{accentColor === colour.value ? <Check size={13}/> : null}</span></button>
                  ))}
                </div>
                <label className="field-label" htmlFor="replay-caption-font">CAPTION TYPEFACE</label>
                <select id="replay-caption-font" className="text-input replay-select" value={captionFont} onChange={(event) => setCaptionFont(event.target.value)}>
                  <option value="Inter, ui-sans-serif, system-ui, sans-serif">Modern sans</option>
                  <option value="Arial, Helvetica, sans-serif">Clean classic</option>
                  <option value="Georgia, serif">Editorial serif</option>
                </select>
                <div className="replay-slider-heading"><label className="field-label" htmlFor="replay-caption-size">CAPTION SIZE</label><span>{captionScale}%</span></div>
                <input id="replay-caption-size" className="replay-range" type="range" min="80" max="120" step="5" value={captionScale} onChange={(event) => setCaptionScale(Number(event.target.value))} />
                <label className="field-label" htmlFor="replay-caption-position">CAPTION PLACEMENT</label>
                <select id="replay-caption-position" className="text-input replay-select" value={captionPosition} onChange={(event) => setCaptionPosition(event.target.value)}>
                  <option value="auto">Smart placement (avoid highlights)</option>
                  <option value="bottom">Bottom</option>
                  <option value="top">Top</option>
                </select>
                <div className="replay-live-preview" aria-live="polite">
                  <span>LIVE STYLE PREVIEW</span>
                  <div className="replay-preview-caption" style={{borderColor:accentColor, fontFamily:captionFont, fontSize:`clamp(${12 * captionScale / 100}px, ${1.2 * captionScale / 100}vw, ${15 * captionScale / 100}px)`}}>Your demo, refreshed.</div>
                  <small>Changes are included in the exported workflow.</small>
                </div>
                <label className="field-label" htmlFor="replay-brand-name">END CARD BRAND</label>
                <input id="replay-brand-name" className="text-input" value={brandName} maxLength={32} onChange={(event) => setBrandName(event.target.value)} placeholder="YOUR BRAND" />
                <label className="field-label" htmlFor="replay-end-headline">END CARD HEADLINE</label>
                <input id="replay-end-headline" className="text-input" value={endHeadline} maxLength={100} onChange={(event) => setEndHeadline(event.target.value)} placeholder="Your product evolves. Your demo keeps up." />
                <div className="replay-style-row"><span>Spotlight effects</span><span className="replay-style-enabled"><Check size={12} /> Per step</span></div>
                <div className="replay-style-row"><span>Branded end card</span><span className="replay-style-enabled"><Check size={12} /> 3.5 sec</span></div>
              </div>

              <div className="replay-download-box">
                <FileJson size={21} />
                <div><strong>Reusable workflow recipe</strong><span>Save the JSON in your repo, then import it here next time to refresh the demo.</span></div>
              </div>
              <label className="button button-secondary full-width replay-download-button" htmlFor="replay-import-workflow"><Download size={16} /> Import saved workflow JSON</label>
              <input id="replay-import-workflow" type="file" accept=".json,application/json" onChange={importWorkflow} style={{ display: "none" }} />
              <button className="button button-primary full-width replay-download-button" onClick={startReplay} disabled={!validUrl || steps.length === 0 || submitting || ["queued", "running", "submitting"].includes(jobStatus)}><Video size={16} /> {submitting || ["queued", "running", "submitting"].includes(jobStatus) ? "Replay in progress…" : "Generate demo video"}</button>
              <button className="button button-secondary full-width replay-download-button" onClick={downloadWorkflow} disabled={!validUrl || steps.length === 0}><Download size={16} /> Download workflow JSON</button>
              {(jobStatus || jobError) && <div className={jobError ? "replay-job-status replay-job-error" : "replay-job-status"} role="status">
                <strong>{jobError ? "Replay needs attention" : jobStatus === "completed" ? "Your demo is ready" : jobStatus === "failed" ? "Replay failed" : "Replay status"}</strong>
                <span>{jobError || jobMessage}</span>
                {jobStatus === "completed" && jobId && <a className="button button-primary full-width" href={`/api/replay/${jobId}/video`} download><Download size={15} /> Download recording</a>}
                {jobStatus === "failed" && <button className="button button-secondary full-width" onClick={() => { setJobId(null); setJobStatus(""); setJobError(""); setJobMessage(""); }}>Edit workflow and retry</button>}
              </div>}
              {downloaded && <div className="replay-inline-success" role="status"><Check size={14} /> demo-flow.json downloaded. Keep it private if it contains internal URLs.</div>}
              <p className="replay-small-note">The file contains step definitions and your target URL, but no login password or API key.</p>
            </div>

            <div className="replay-steps-panel">
              <div className="replay-steps-heading"><div><span className="eyebrow">THE RECIPE</span><h3>What should Cutlume do?</h3></div><button className="button button-secondary button-small" onClick={addStep}><Plus size={14} /> Add step</button></div>
              <div className="replay-step-list">
                {steps.map((step, index) => (
                  <article className="replay-step-card" key={step.id}>
                    <div className="replay-step-card-top">
                      <span className="replay-step-number">{String(index + 1).padStart(2, "0")}</span>
                      <div className="replay-step-title"><strong>{step.label || "Untitled step"}</strong><span>{actionLabels[step.action]}</span></div>
                      <div className="replay-step-actions">
                        <button className="replay-icon-button" onClick={() => moveStep(step.id, -1)} aria-label={`Move step ${index + 1} up`} disabled={index === 0}><ChevronUp size={15} /></button>
                        <button className="replay-icon-button" onClick={() => moveStep(step.id, 1)} aria-label={`Move step ${index + 1} down`} disabled={index === steps.length - 1}><ChevronDown size={15} /></button>
                        <button className="replay-icon-button" onClick={() => removeStep(step.id)} aria-label={`Remove step ${index + 1}`} disabled={steps.length === 1}><Trash2 size={15} /></button>
                      </div>
                    </div>
                    <label className="field-label" htmlFor={`action-${step.id}`}>ACTION</label>
                    <select id={`action-${step.id}`} className="text-input replay-select" value={step.action} onChange={(event) => updateStep(step.id, { action: event.target.value as ReplayAction })}>
                      {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <label className="field-label" htmlFor={`label-${step.id}`}>STEP LABEL</label>
                    <input id={`label-${step.id}`} className="text-input" value={step.label} onChange={(event) => updateStep(step.id, { label: event.target.value })} placeholder="What is happening?" />
                    {step.action !== "wait" && step.action !== "screenshot" && step.action !== "waitForText" && <>
                      <label className="field-label" htmlFor={`selector-${step.id}`}>{step.action === "waitForStableText" ? "TEXT TARGET SELECTOR" : step.action === "upload" ? "ATTACH BUTTON SELECTOR" : "CSS SELECTOR"}</label>
                      <input id={`selector-${step.id}`} className="text-input replay-code-input" value={step.selector} onChange={(event) => updateStep(step.id, { selector: event.target.value })} placeholder={step.action === "upload" ? "e.g. [data-testid='attach-image']" : "e.g. button[type='submit'] or [data-testid='send']"} /> 
                      <details className="replay-locator-options"><summary>Accessible locator options</summary>
                        <label className="field-label" htmlFor={`role-${step.id}`}>ROLE</label><input id={`role-${step.id}`} className="text-input" value={step.role || ""} onChange={(event) => updateStep(step.id, { role: event.target.value })} placeholder="button, textbox, link" />
                        <label className="field-label" htmlFor={`name-${step.id}`}>ACCESSIBLE NAME</label><input id={`name-${step.id}`} className="text-input" value={step.name || ""} onChange={(event) => updateStep(step.id, { name: event.target.value })} placeholder="Send prompt" />
                        <label className="field-label" htmlFor={`placeholder-${step.id}`}>PLACEHOLDER</label><input id={`placeholder-${step.id}`} className="text-input" value={step.placeholder || ""} onChange={(event) => updateStep(step.id, { placeholder: event.target.value })} placeholder="Ask anything…" />
                        <label className="field-label" htmlFor={`testid-${step.id}`}>TEST ID</label><input id={`testid-${step.id}`} className="text-input" value={step.testId || ""} onChange={(event) => updateStep(step.id, { testId: event.target.value })} placeholder="prompt-input" />
                        <label className="field-label" htmlFor={`locator-label-${step.id}`}>FORM LABEL</label><input id={`locator-label-${step.id}`} className="text-input" value={step.locatorLabel || ""} onChange={(event) => updateStep(step.id, { locatorLabel: event.target.value })} placeholder="Prompt" />
                        <><label className="field-label" htmlFor={`locator-text-${step.id}`}>VISIBLE TEXT TARGET</label><input id={`locator-text-${step.id}`} className="text-input" value={step.locatorText || ""} onChange={(event) => updateStep(step.id, { locatorText: event.target.value })} placeholder="Attach image" /></>
                        <label className="replay-check-row"><input type="checkbox" checked={Boolean(step.exact)} onChange={(event) => updateStep(step.id, { exact: event.target.checked })} /><span className="replay-check-box"><Check size={12} /></span><span>Match text exactly</span></label>
                      </details>
                      {step.action === "upload" && <p className="replay-field-hint">Uses Cutlume’s bundled sample image only. Arbitrary file uploads are disabled in the hosted prototype.</p>}
                    </>}
                    {(step.action === "fill" || step.action === "press" || step.action === "waitForText" || step.action === "waitForStableText" || step.action === "wait") && <>
                      <label className="field-label" htmlFor={`value-${step.id}`}>{step.action === "wait" ? "PAUSE LENGTH (MS)" : step.action === "fill" ? "TEXT TO TYPE" : step.action === "press" ? "KEY TO PRESS" : "EXPECTED TEXT (OPTIONAL)"}</label>
                      {step.action === "press" ? (
                        <select id={`value-${step.id}`} className="text-input replay-select" value={step.value || "Enter"} onChange={(event) => updateStep(step.id, { value: event.target.value })}>
                          <option value="Enter">Enter — submit / continue</option>
                          <option value="Tab">Tab — next field</option>
                          <option value="Escape">Escape — close / cancel</option>
                          <option value="Backspace">Backspace — delete</option>
                          <option value="Space">Space — activate</option>
                          <option value="ArrowDown">Arrow down</option>
                          <option value="ArrowUp">Arrow up</option>
                        </select>
                      ) : (
                        <input id={`value-${step.id}`} className="text-input" value={step.value} onChange={(event) => updateStep(step.id, { value: event.target.value })} placeholder={step.action === "wait" ? "800" : step.action === "fill" ? "Text to enter into the field" : "Text or response to wait for"} />
                      )}
                    </>}
                    <label className="field-label" htmlFor={`caption-${step.id}`}>ON-VIDEO CAPTION</label>
                    <input id={`caption-${step.id}`} className="text-input" value={step.caption} onChange={(event) => updateStep(step.id, { caption: event.target.value })} placeholder="A short line that tells the story" />
                    <label className="replay-check-row"><input type="checkbox" checked={step.effect} onChange={(event) => updateStep(step.id, { effect: event.target.checked })} /><span className="replay-check-box"><Check size={12} /></span><span>Highlight this step with a spotlight effect</span></label>
                  </article>
                ))}
              </div>
              <button className="replay-add-step" onClick={addStep}><Plus size={15} /> Add another step to the workflow</button>
            </div>
          </div>
        </section>

        <section className="replay-connection">
          <div className="replay-connection-icon"><LockKeyhole size={20} /></div>
          <div className="replay-connection-copy"><span className="eyebrow">{workerConfigured ? "REPLAY SERVICE" : "SETUP REQUIRED"}</span><h2>{workerConfigured ? "The replay service is connected." : "Connect the replay service to run workflows."}</h2><p>{workerConfigured ? "The server reports that the replay worker is configured. Test with a staging app and dummy data first; compatibility with your app is not guaranteed until a complete replay succeeds." : "This preview cannot run a workflow yet. The server needs a worker URL, private token, and allowed test host. You can still download the JSON recipe and prepare your workflow."}</p></div>
          <div className="replay-connection-status"><span className="replay-status-dot" /> {workerConfigured ? "Worker configured" : "Worker setup required"}</div>
        </section>

        <footer className="replay-footer"><Link className="brand replay-brand" href="/"><span className="brand-mark"><Clapperboard size={16} /></span><span>cutlume<span className="brand-period">.</span></span></Link><span>Build the workflow once. Refresh the demo when the product changes.</span><Link className="replay-footer-link" href="/">Launch studio <ArrowUpRight size={13} /></Link></footer>
      </div>
    </main>
  );
}

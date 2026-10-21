"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { LaunchFilmComposition } from "./components/LaunchFilmComposition";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clapperboard,
  Clock3,
  Download,
  Film,
  LoaderCircle,
  Layers3,
  Play,
  Plus,
  Sparkles,
  Upload,
  WandSparkles,
  Workflow,
  X,
} from "lucide-react";

type Scene = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  duration: number;
  motion: string;
};

type Project = {
  name: string;
  productUrl: string;
  mood: string;
  format: string;
  scenes: Scene[];
};

const initialScenes: Scene[] = [
  { id: "hook", kind: "01 · OPEN", title: "Your next big idea.", subtitle: "A better way to work starts here.", duration: 3, motion: "Slow reveal" },
  { id: "reveal", kind: "02 · REVEAL", title: "Meet your new workspace.", subtitle: "Everything important, in one place.", duration: 4, motion: "Focus zoom" },
  { id: "feature", kind: "03 · FEATURE", title: "From busywork to flow.", subtitle: "Less friction. More momentum.", duration: 6, motion: "Slide & settle" },
  { id: "close", kind: "04 · CLOSE", title: "Make room for what matters.", subtitle: "Your next chapter starts now.", duration: 4, motion: "Soft fade" },
];

const steps = ["Your assets", "Creative direction", "Storyboard", "Preview"];

export default function Home() {
  const [workspace, setWorkspace] = useState(false);
  const [stage, setStage] = useState(0);
  const [projectName, setProjectName] = useState("My launch film");
  const [productUrl, setProductUrl] = useState("");
  const [mood, setMood] = useState("Cinematic");
  const [format, setFormat] = useState("Landscape · 16:9");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [activeScene, setActiveScene] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewSceneIndex, setPreviewSceneIndex] = useState(0);
  const [previewSecond, setPreviewSecond] = useState(0);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState("");
  const [exportSuccess, setExportSuccess] = useState("");

  const totalDuration = useMemo(() => scenes.reduce((sum, scene) => sum + scene.duration, 0), [scenes]);
  const selectedScene = scenes[activeScene] ?? scenes[0];
  const previewScene = scenes[previewSceneIndex] ?? scenes[0];

  useEffect(() => {
    if (!previewPlaying || stage !== 3 || scenes.length === 0) return;
    const timer = window.setInterval(() => {
      setPreviewSecond((second) => {
        const current = scenes[previewSceneIndex] ?? scenes[0];
        if (second + 1 >= Math.max(2, current.duration)) {
          setPreviewSceneIndex((index) => (index + 1) % scenes.length);
          return 0;
        }
        return second + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [previewPlaying, stage, scenes, previewSceneIndex]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cutlume-draft-v1");
      if (raw) {
        const draft = JSON.parse(raw) as Partial<Project>;
        if (draft.name) setProjectName(draft.name);
        if (draft.productUrl) setProductUrl(draft.productUrl);
        if (draft.mood) setMood(draft.mood);
        if (draft.format) setFormat(draft.format);
        if (draft.scenes?.length) setScenes(draft.scenes);
      }
    } catch {
      // Local draft is optional; the app remains usable if storage is blocked.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("cutlume-draft-v1", JSON.stringify({ name: projectName, productUrl, mood, format, scenes }));
      setSaved(true);
      const id = window.setTimeout(() => setSaved(false), 1600);
      return () => window.clearTimeout(id);
    } catch {
      setSaved(false);
    }
  }, [projectName, productUrl, mood, format, scenes]);

  function handleFile(event: ChangeEvent<HTMLInputElement>, type: "reference" | "product") {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      window.alert("For this early prototype, please choose a file smaller than 100 MB.");
      event.target.value = "";
      return;
    }
    if (type === "reference") setReferenceFile(file);
    else setProductFile(file);
  }

  function updateScene(field: "title" | "subtitle" | "duration" | "motion", value: string | number) {
    setScenes((current) => current.map((scene, index) => index === activeScene ? { ...scene, [field]: value } : scene));
  }

  function downloadStoryboard() {
    const payload = {
      product: projectName,
      productUrl,
      creativeDirection: { mood, format, referenceFileName: referenceFile?.name ?? null, productFootageName: productFile?.name ?? null },
      durationSeconds: totalDuration,
      scenes,
      note: "Storyboard generated from editable templates. Reference video has not been automatically analysed.",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cutlume-storyboard.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportMp4() {
    if (exporting || scenes.length === 0) return;

    setExporting(true);
    setExportProgress(0);
    setExportError("");
    setExportSuccess("");

    try {
      const fps = 30;
      const dimensions = format.startsWith("Portrait")
        ? { width: 720, height: 1280 }
        : format.startsWith("Square")
          ? { width: 720, height: 720 }
          : { width: 1280, height: 720 };
      const durationInFrames = scenes.reduce(
        (sum, scene) => sum + Math.max(2, Math.round(scene.duration * fps)),
        0,
      );

      if (typeof window === "undefined" || !("VideoEncoder" in window)) {
        throw new Error("MP4 export needs a modern browser with WebCodecs support. Try the latest Chrome or another supported desktop browser.");
      }

      setExportProgress(3);
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
      const support = await canRenderMediaOnWeb({
        ...dimensions,
        container: "mp4",
        videoCodec: "h264",
        muted: true,
      });

      if (!support.canRender) {
        throw new Error(
          support.issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => issue.message)
            .join(" ") || "This browser cannot render the selected MP4 format.",
        );
      }

      setExportProgress(8);
      const { getBlob } = await renderMediaOnWeb({
        composition: {
          component: LaunchFilmComposition,
          durationInFrames,
          fps,
          width: dimensions.width,
          height: dimensions.height,
          id: "cutlume-launch-film",
          defaultProps: { scenes, mood, projectName },
        },
        inputProps: { scenes, mood, projectName },
        container: "mp4",
        videoCodec: "h264",
        muted: true,
        onProgress: ({ progress }: { progress: number }) => {
          const percent = Math.max(8, Math.min(99, Math.round(progress * 100)));
          setExportProgress((currentProgress) => currentProgress === percent ? currentProgress : percent);
        },
      });

      const blob = await getBlob();
      if (!blob || blob.size === 0) {
        throw new Error("The renderer finished without producing a video file. Please try again with fewer scenes.");
      }

      const safeName =
        (projectName || "cutlume-launch-film")
          .trim()
          .replace(/[^a-zA-Z0-9-_]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase() || "cutlume-launch-film";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeName}.mp4`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

      setExportProgress(100);
      setExportSuccess("Your MP4 is ready. Open it in a video player to check the result.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The MP4 could not be rendered.";
      setExportError(message);
    } finally {
      setExporting(false);
    }
  }

  function resetProject() {
    setStage(0);
    setWorkspace(false);
    setScenes(initialScenes);
    setActiveScene(0);
    setExportError("");
    setExportSuccess("");
  }

  return (
    <main className="app-root">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <button className="brand" onClick={resetProject} aria-label="Cutlume home">
          <span className="brand-mark"><Clapperboard size={19} strokeWidth={2.2} /></span>
          <span>cutlume<span className="brand-period">.</span></span>
        </button>
        <nav className="top-nav" aria-label="Main navigation">
          <a href="/motion">Motion library</a>
          <a href="/replay">Demo replay</a>
          <a href="/pricing">Pilot pricing</a>
          <a href="#how-it-works">How it works</a>
          <a href="#principles">The approach</a>
        </nav>
        <div className="top-actions">
          <span className="beta-label"><span className="status-dot" /> Early access</span>
          <button className="button button-small button-primary" onClick={() => { setWorkspace(true); setStage(0); }}>
            Open studio <ArrowUpRight size={15} />
          </button>
        </div>
      </header>

      {!workspace ? (
        <>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><Sparkles size={13} /> BUILT FOR INDIE SAAS FOUNDERS</div>
              <h1>Your product ships.<br /><span className="gradient-text">Your demo stays fresh.</span></h1>
              <p className="hero-description">Record your product flow once. Replay it after your UI changes. Keep the captions, highlights and branded ending—and export a shareable demo video without re-recording every click.</p>
              <div className="hero-actions">
                <a className="button button-primary button-large" href="/replay">
                  Build a replay workflow <ArrowRight size={17} />
                </a>
                <a className="text-link" href="#how-it-works"><span className="play-outline"><Play size={12} fill="currentColor" /></span> See the process</a>
                <a className="text-link" href="/replay"><span className="play-outline"><ArrowUpRight size={12} /></span> Try demo replay</a>
              </div>
              <div className="hero-proof">
                <div className="avatar-stack"><span>✳</span><span>◈</span><span>↗</span></div>
                <span>For small teams with big launches.</span>
              </div>
            </div>

            <div className="hero-visual" aria-label="Illustrative cinematic launch storyboard">
              <div className="visual-topline"><span><span className="live-dot" /> YOUR NEXT RELEASE</span><span>FILM / 001</span></div>
              <div className="film-stage">
                <div className="stage-orbit orbit-a" /><div className="stage-orbit orbit-b" />
                <div className="stage-grid" />
                <div className="stage-glow" />
                <div className="floating-window window-back">
                  <div className="window-head"><span /><span /><span /><b>workspace / overview</b></div>
                  <div className="fake-side"><i /><i /><i /><i /></div>
                  <div className="fake-main"><div className="fake-line wide" /><div className="fake-line" /><div className="fake-metrics"><span /><span /><span /></div><div className="fake-chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
                </div>
                <div className="floating-window window-front">
                  <div className="window-head"><span /><span /><span /><b>your next big idea.</b></div>
                  <div className="front-content"><div className="mini-eyebrow">INTRODUCING SOMETHING NEW</div><div className="mini-headline">Make work<br /><em>feel different.</em></div><div className="mini-cta">Meet the workspace <ArrowUpRight size={10} /></div></div>
                </div>
                <div className="float-tag tag-top"><Sparkles size={12} /> STORY, NOT JUST SCREENS</div>
                <div className="float-tag tag-bottom"><span className="equalizer"><i /><i /><i /><i /><i /></span> MOTION / ON</div>
                <div className="frame-corner corner-a" /><div className="frame-corner corner-b" /><div className="frame-corner corner-c" /><div className="frame-corner corner-d" />
              </div>
              <div className="visual-footer"><span>STYLE FRAME <b>01 / 04</b></span><span>DESIGNED TO MOVE <ArrowDownRight size={14} /></span></div>
            </div>
          </section>

          <section className="ticker" aria-label="Product values">
            <span>VERSION-CONTROLLED WORKFLOWS</span><i /> <span>REPLAY AFTER UI CHANGES</span><i /> <span>CAPTIONS & SPOTLIGHTS</span><i /> <span>MP4-FIRST SHARING</span>
          </section>

          <section className="section workflow-section" id="founder-workflow">
            <div className="section-heading"><div><div className="eyebrow">THE PAINFUL PART, REMOVED</div><h2>Fix the UI.<br /><span className="gradient-text">Not the whole demo.</span></h2></div><p>For founders who keep re-recording the same product walkthrough every time a button moves or a screen changes.</p></div>
            <div className="workflow-grid">
              <article className="workflow-card"><div className="step-number">01 <ArrowUpRight size={15} /></div><div className="workflow-icon"><Workflow size={21} /></div><h3>Define the flow in JSON.</h3><p>Keep your steps in the repo, review changes, and reuse the same workflow across releases.</p><div className="chip-row"><span>Version-controlled</span><span>Repeatable</span></div></article>
              <article className="workflow-card"><div className="step-number">02 <ArrowUpRight size={15} /></div><div className="workflow-icon"><WandSparkles size={21} /></div><h3>Replay after a change.</h3><p>Use accessible locators where available, wait for streamed answers, and spot failures with a report instead of guessing.</p><div className="chip-row"><span>UI-change friendly</span><span>Failure report</span></div></article>
              <article className="workflow-card"><div className="step-number">03 <ArrowUpRight size={15} /></div><div className="workflow-icon"><Film size={21} /></div><h3>Export a shareable demo.</h3><p>Add readable captions, spotlight key moments, and finish with your brand. MP4 export depends on a working replay and FFmpeg.</p><div className="chip-row"><span>Captions</span><span>Branded end card</span></div></article>
            </div>
            <div className="founder-note"><span className="status-dot" /> <span><strong>Honest beta:</strong> the replay engine passes its controlled smoke tests. Compatibility with your real app—especially Flutter canvas interfaces—must be verified before relying on it.</span><a className="text-link" href="/replay">Explore demo replay <ArrowUpRight size={14} /></a></div>
          </section>

          <section id="how-it-works" className="section workflow-section">
            <div className="section-heading"><div><div className="eyebrow">A REPEATABLE RELEASE WORKFLOW</div><h2>From one setup<br />to <span className="gradient-text">every release.</span></h2></div><p>Keep the flow in your repo. Run it against a test environment after changes. Inspect the result before sharing it with customers.</p></div>
            <div className="workflow-grid">
              <article className="workflow-card"><div className="step-number">01 <ArrowUpRight size={15} /></div><div className="workflow-icon"><Workflow size={21} /></div><h3>Save the workflow.</h3><p>Describe the key actions in a JSON file your team can review and version alongside the app.</p><div className="chip-row"><span>JSON config</span><span>Git-friendly</span></div></article>
              <article className="workflow-card"><div className="step-number">02 <ArrowUpRight size={15} /></div><div className="workflow-icon"><WandSparkles size={21} /></div><h3>Replay and inspect.</h3><p>Wait for streamed content, capture failures with reports, and adjust locators when the interface changes.</p><div className="chip-row"><span>Replay</span><span>Failure report</span></div></article>
              <article className="workflow-card"><div className="step-number">03 <ArrowUpRight size={15} /></div><div className="workflow-icon"><Film size={21} /></div><h3>Share the fresh demo.</h3><p>Use readable captions, spotlights and a branded end card, then verify the exported video before posting.</p><div className="chip-row"><span>MP4 output</span><span>Branding</span></div></article>
            </div>
          </section>

          <section id="principles" className="manifesto">
            <div className="manifesto-symbol"><Layers3 size={23} /></div>
            <div className="manifesto-copy"><div className="eyebrow">OUR PRODUCT PRINCIPLE</div><h2>Useful first.<br /><span className="gradient-text">Polished second.</span></h2><p>Cutlume should save founders repeat work, not create another editing chore. Keep workflows inspectable, report failures honestly, and only share a video after the real app replay succeeds.</p></div>
            <div className="manifesto-side"><span>01 — REPEATABLE FLOWS</span><span>02 — VISIBLE FAILURES</span><span>03 — MP4 WHEN VERIFIED</span></div>
          </section>

          <section className="closing-cta"><div className="closing-glow" /><div className="eyebrow">YOUR NEXT LAUNCH DESERVES A STORY</div><h2>Let's make it<br /><span className="gradient-text">feel like something.</span></h2><button className="button button-primary button-large" onClick={() => { setWorkspace(true); setStage(0); }}>Build a first draft <ArrowRight size={17} /></button><p>No AI credits required for this prototype. Your project stays in this browser.</p></section>

          <footer className="footer"><button className="brand brand-footer" onClick={resetProject}><span className="brand-mark"><Clapperboard size={16} /></span><span>cutlume<span className="brand-period">.</span></span></button><span>Made for the work behind the launch.</span><button className="footer-feedback" onClick={() => setShowFeedback(true)}>Help shape the product <ArrowUpRight size={14} /></button></footer>
        </>
      ) : (
        <section className="studio-shell">
          <div className="studio-heading">
            <div><button className="back-link" onClick={() => setWorkspace(false)}><ArrowLeft size={15} /> Back to overview</button><div className="eyebrow studio-eyebrow"><span className="status-dot" /> YOUR CREATIVE WORKSPACE</div><h1>Make a little <span className="gradient-text">movie magic.</span></h1><p>Build a launch story from the product you already have.</p></div>
            <div className="save-indicator"><span className="save-dot" /> {saved ? "Draft saved locally" : "Local draft"}</div>
          </div>
          <div className="stepper">
            {steps.map((step, index) => <button key={step} className={`stepper-item ${stage === index ? "active" : ""} ${stage > index ? "complete" : ""}`} onClick={() => setStage(index)}><span className="stepper-number">{stage > index ? <Check size={13} /> : `0${index + 1}`}</span><span>{step}</span></button>)}
          </div>

          {stage === 0 && <div className="studio-grid">
            <div className="studio-main-panel panel">
              <div className="panel-heading"><div><div className="eyebrow">STEP 01 / SOURCE MATERIAL</div><h2>Start with the good stuff.</h2><p>Two ingredients. One launch story.</p></div><span className="panel-icon"><Upload size={18} /></span></div>
              <label className="field-label" htmlFor="project-name">PROJECT NAME</label><input id="project-name" className="text-input" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Orbit launch film" />
              <label className="field-label" htmlFor="product-url">PRODUCT URL <span className="optional">OPTIONAL</span></label><input id="product-url" className="text-input" value={productUrl} onChange={(event) => setProductUrl(event.target.value)} placeholder="https://yourproduct.com" inputMode="url" />
              <div className="upload-grid">
                <div className="upload-card"><div className="upload-card-top"><span className="upload-icon"><Film size={18} /></span><span className="required-label">01 · REFERENCE</span></div><h3>Show me the feeling.</h3><p>A launch video whose rhythm, transitions or atmosphere you admire.</p>{referenceFile ? <div className="file-pill"><Check size={14} /><span>{referenceFile.name}</span><button onClick={() => setReferenceFile(null)} aria-label="Remove reference file"><X size={14} /></button></div> : <label className="upload-button"><Plus size={15} /> Add reference video<input type="file" accept="video/*" onChange={(event) => handleFile(event, "reference")} hidden /></label>}<span className="file-note">Video file · up to 100 MB</span></div>
                <div className="upload-card"><div className="upload-card-top"><span className="upload-icon"><Layers3 size={18} /></span><span className="required-label">02 · YOUR PRODUCT</span></div><h3>Show me the real thing.</h3><p>A screen recording or screenshot of the product you want people to remember.</p>{productFile ? <div className="file-pill"><Check size={14} /><span>{productFile.name}</span><button onClick={() => setProductFile(null)} aria-label="Remove product file"><X size={14} /></button></div> : <label className="upload-button"><Plus size={15} /> Add product footage<input type="file" accept="video/*,image/*" onChange={(event) => handleFile(event, "product")} hidden /></label>}<span className="file-note">Video or image · up to 100 MB</span></div>
              </div>
              <div className="privacy-note"><span className="privacy-icon">⌁</span><p><strong>Your creative stays yours.</strong> This prototype keeps project settings in this browser. Selected files are used for local previews and are not uploaded to a server by this page.</p></div>
              <div className="panel-footer"><span className="step-hint">You can start with sample content, too.</span><button className="button button-primary" onClick={() => setStage(1)}>Set the direction <ArrowRight size={16} /></button></div>
            </div>
            <aside className="side-note"><div className="side-note-number">A NOTE ON REFERENCES</div><h3>Steal the feeling.<br /><em>Not the frames.</em></h3><p>We'll use your reference to guide broad choices like pacing, contrast and transitions. This prototype doesn't analyse the video automatically yet.</p><div className="side-note-line" /><div className="side-note-bottom"><Sparkles size={15} /> ORIGINAL STORIES, ALWAYS</div></aside>
          </div>}

          {stage === 1 && <div className="studio-grid"><div className="studio-main-panel panel"><div className="panel-heading"><div><div className="eyebrow">STEP 02 / CREATIVE DIRECTION</div><h2>Choose the feeling.</h2><p>Think of this as a mini creative brief for your film.</p></div><span className="panel-icon"><Sparkles size={18} /></span></div><label className="field-label">VISUAL MOOD</label><div className="mood-grid">{["Cinematic", "Minimal", "Playful", "High energy"].map((item) => <button key={item} onClick={() => setMood(item)} className={`mood-card ${mood === item ? "selected" : ""}`}><span className={`mood-art mood-${item.toLowerCase().replace(" ", "-")}`}><i /><i /><i /></span><span>{item}</span>{mood === item && <Check size={14} />}</button>)}</div><label className="field-label">OUTPUT FORMAT</label><div className="format-options">{["Landscape · 16:9", "Portrait · 9:16", "Square · 1:1"].map((item) => <button key={item} onClick={() => setFormat(item)} className={`format-option ${format === item ? "selected" : ""}`}><span className={`format-icon ${item.startsWith("Portrait") ? "portrait" : item.startsWith("Square") ? "square" : ""}`} /><span>{item}</span>{format === item && <Check size={14} />}</button>)}</div><div className="direction-note"><Sparkles size={16} /><span>Your selection sets the creative direction. Automatic reference-video analysis is not implemented in this early build.</span></div><div className="panel-footer"><button className="button button-quiet" onClick={() => setStage(0)}><ArrowLeft size={15} /> Back</button><button className="button button-primary" onClick={() => setStage(2)}>Build storyboard <ArrowRight size={16} /></button></div></div><aside className="side-note"><div className="side-note-number">CREATIVE BRIEF / 001</div><h3>One clear idea<br /><em>beats ten effects.</em></h3><p>Great launch films make the product's value obvious. Motion is there to guide attention, not compete with the interface.</p><div className="side-note-line" /><div className="side-note-bottom"><Clock3 size={15} /> TARGET LENGTH · 15–20 SEC</div></aside></div>}

          {stage === 2 && <div className="storyboard-layout"><div className="storyboard-column"><div className="panel-heading"><div><div className="eyebrow">STEP 03 / STORY STRUCTURE</div><h2>A story in four beats.</h2><p>Edit each scene. Keep what works. Make it yours.</p></div><button className="button button-quiet button-small" onClick={() => { setScenes(initialScenes); setActiveScene(0); }}>Reset <ArrowRight size={13} /></button></div><div className="scene-list">{scenes.map((scene, index) => <button key={scene.id} className={`scene-row ${activeScene === index ? "selected" : ""}`} onClick={() => setActiveScene(index)}><div className={`scene-thumb scene-thumb-${index % 4}`}><span>{String(index + 1).padStart(2, "0")}</span><div className="thumb-lines"><i /><i /><i /></div></div><div className="scene-row-copy"><span className="scene-kind">{scene.kind}</span><strong>{scene.title}</strong><span className="scene-subtitle">{scene.subtitle}</span></div><span className="scene-time">{scene.duration}s</span><ArrowUpRight className="scene-arrow" size={14} /></button>)}</div><button className="add-scene-button" onClick={() => { const newScene = { id: `scene-${Date.now()}`, kind: `0${scenes.length + 1} · NEW SCENE`, title: "A moment worth showing.", subtitle: "Your product, in its best light.", duration: 3, motion: "Slow reveal" }; setScenes((current) => [...current, newScene]); setActiveScene(scenes.length); }}><Plus size={15} /> Add another scene</button><div className="panel-footer"><button className="button button-quiet" onClick={() => setStage(1)}><ArrowLeft size={15} /> Back</button><button className="button button-primary" onClick={() => setStage(3)}>Preview film <Play size={14} /></button></div></div><div className="scene-edit-panel panel"><div className="eyebrow">SCENE SETTINGS</div><div className={`edit-preview scene-thumb-${activeScene % 4}`}><span className="edit-preview-kicker">{selectedScene?.kind}</span><strong>{selectedScene?.title}</strong><span className="edit-preview-sub">{selectedScene?.subtitle}</span><div className="preview-sweep" /></div>{selectedScene && <><label className="field-label" htmlFor="scene-title">HEADLINE</label><input id="scene-title" className="text-input" value={selectedScene.title} onChange={(event) => updateScene("title", event.target.value)} /><label className="field-label" htmlFor="scene-subtitle">SUPPORTING LINE</label><textarea id="scene-subtitle" className="text-input text-area" value={selectedScene.subtitle} onChange={(event) => updateScene("subtitle", event.target.value)} rows={2} /><div className="duration-header"><label className="field-label" htmlFor="scene-duration">DURATION</label><span>{selectedScene.duration}s</span></div><input id="scene-duration" className="range-input" type="range" min="2" max="8" value={selectedScene.duration} onChange={(event) => updateScene("duration", Number(event.target.value))} /><label className="field-label" htmlFor="scene-motion">MOTION PRESET</label><div className="select-wrap"><select id="scene-motion" className="text-input" value={selectedScene.motion} onChange={(event) => updateScene("motion", event.target.value)}><option>Slow reveal</option><option>Focus zoom</option><option>Slide & settle</option><option>Soft fade</option><option>Orbit drift</option></select><ChevronDown size={15} /></div></>}<div className="scene-edit-foot"><span><span className="save-dot" /> Changes save locally</span><span>SCENE {String(activeScene + 1).padStart(2, "0")}</span></div></div></div>}

          {stage === 3 && <div className="export-layout"><div className="export-preview panel"><div className="preview-toolbar"><span><span className="live-dot" /> PREVIEW / {format.toUpperCase()}</span><span>{totalDuration}s total</span></div><div className={`final-film format-${format.startsWith("Portrait") ? "portrait" : format.startsWith("Square") ? "square" : "landscape"} scene-thumb-${previewSceneIndex % 4} ${previewPlaying ? "preview-is-playing" : ""}`} key={`${previewSceneIndex}-${previewPlaying ? "play" : "pause"}`}><div className="film-grain" /><div className="film-kicker">{previewScene?.kind} · {projectName || "YOUR PRODUCT"}</div><h2>{previewScene?.title}</h2><p>{previewScene?.subtitle}</p><div className="film-ui"><span /><span /><span /></div><div className="film-progress"><i style={{ width: `${((previewSceneIndex + previewSecond / Math.max(2, previewScene?.duration ?? 2)) / scenes.length) * 100}%` }} /></div><div className="film-play-overlay">{previewPlaying ? "PLAYING PREVIEW" : "PREVIEW PAUSED"}</div></div><div className="preview-controls"><button className="button button-primary" onClick={() => setPreviewPlaying((playing) => !playing)}><Play size={15} fill="currentColor" /> {previewPlaying ? "Pause preview" : "Play film"}</button><button className="button button-quiet" onClick={() => { setPreviewPlaying(false); setPreviewSecond(0); setPreviewSceneIndex((previewSceneIndex - 1 + scenes.length) % scenes.length); }}><ArrowLeft size={15} /> Previous</button><span>SCENE {previewSceneIndex + 1} / {scenes.length}</span><button className="button button-quiet" onClick={() => { setPreviewPlaying(false); setPreviewSecond(0); setPreviewSceneIndex((previewSceneIndex + 1) % scenes.length); }}>Next <ArrowRight size={15} /></button></div><div className="preview-disclaimer"><Sparkles size={15} /><span>Playable animated storyboard preview. This prototype still does not combine your uploaded footage or analyse reference videos automatically.</span></div></div><aside className="export-side panel"><div className="eyebrow">YOUR FIRST CUT</div><h2>{projectName || "Untitled launch film"}</h2><p className="export-description">A {mood.toLowerCase()} direction with {scenes.length} scenes, ready for your review.</p><div className="export-stat"><span>EST. DURATION</span><strong>{totalDuration} <small>sec</small></strong></div><div className="export-stat"><span>SCENES</span><strong>{scenes.length}</strong></div><div className="export-stat"><span>FORMAT</span><strong className="format-stat">{format.split(" · ")[1]}</strong></div><button className="button button-primary full-width" onClick={exportMp4} disabled={exporting}>{exporting ? <><LoaderCircle size={16} className="export-spinner" /> Rendering MP4…</> : <><Download size={16} /> Export MP4</>}</button>{exporting && <div className="export-progress-wrap" role="status" aria-live="polite"><div className="export-progress-label"><span>Rendering on this device</span><strong>{exportProgress}%</strong></div><div className="export-progress-track"><i style={{ width: `${exportProgress}%` }} /></div><p>Your browser is creating each frame and encoding the video. Keep this tab open.</p></div>}{exportError && <div className="export-message export-error" role="alert"><strong>Export couldn't finish.</strong><span>{exportError}</span></div>}{exportSuccess && <div className="export-message export-success" role="status"><strong>Export complete</strong><span>{exportSuccess}</span></div>}<button className="button button-secondary full-width" onClick={downloadStoryboard}>Download storyboard JSON <ArrowDownRight size={16} /></button><button className="button button-secondary full-width" onClick={() => { setStage(2); }}>Edit scenes <Layers3 size={15} /></button><button className="button button-quiet full-width" onClick={() => setShowFeedback(true)}>Give feedback <ArrowUpRight size={14} /></button><p className="export-fineprint">Creates a silent MP4 locally in your browser. Your project files are not uploaded. Export support depends on your browser and device.</p></aside></div>}

          <div className="studio-footnote"><span>✳</span> A prototype for original, reference-guided product storytelling.</div>
        </section>
      )}

      {showFeedback && <div className="modal-backdrop" role="presentation" onClick={() => setShowFeedback(false)}><div className="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowFeedback(false)} aria-label="Close feedback"><X size={18} /></button><div className="eyebrow">HELP SHAPE CUTLUME</div><h2 id="feedback-title">What should we make better?</h2><p>This early build doesn't send feedback to a server. You can copy your notes and share them with the maker.</p><textarea className="text-input text-area feedback-area" rows={4} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="What felt useful, confusing, or missing?" /><button className="button button-primary full-width" onClick={() => { const text = `Cutlume feedback\n\n${feedback}`; navigator.clipboard?.writeText(text).then(() => window.alert("Feedback copied. Share it with the maker!")).catch(() => window.alert(text)); setShowFeedback(false); }}>Copy feedback <ArrowUpRight size={15} /></button></div></div>}
    </main>
  );
}
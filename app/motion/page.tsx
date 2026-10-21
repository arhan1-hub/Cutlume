"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaunchFilmComposition } from "../components/LaunchFilmComposition";
import {
  ArrowLeft, ArrowDown, ArrowUp, AudioLines, Check, Clapperboard,
  Film, GripVertical, Layers3, Play, Plus, Sparkles,
  WandSparkles, X
} from "lucide-react";

type MotionPreset = {
  id: string;
  name: string;
  category: string;
  description: string;
  duration: string;
  color: string;
  motion: string;
};

type Scene = { id: string; title: string; preset: MotionPreset; seconds: number };

const presets: MotionPreset[] = [
  { id: "hero", name: "Cinematic reveal", category: "OPENERS", description: "A slow, confident reveal with layered depth.", duration: "2.5s", color: "#8b7bff", motion: "reveal" },
  { id: "kinetic", name: "Kinetic headline", category: "TYPOGRAPHY", description: "Oversized type that lands with energy.", duration: "1.8s", color: "#f3a36f", motion: "type" },
  { id: "ui", name: "Product spotlight", category: "PRODUCT UI", description: "Frame the interface and spotlight one key action.", duration: "3s", color: "#77d9c2", motion: "spotlight" },
  { id: "zoom", name: "Focus zoom", category: "TRANSITIONS", description: "Push into the detail that matters.", duration: "1.2s", color: "#8ca8ff", motion: "zoom" },
  { id: "orbit", name: "Orbiting interface", category: "3D & DEPTH", description: "Floating panels with a subtle orbital drift.", duration: "2.8s", color: "#d5a2ff", motion: "orbit" },
  { id: "split", name: "Before / after", category: "STORY", description: "Show the change, not just the feature list.", duration: "2s", color: "#f1cf79", motion: "split" },
  { id: "cursor", name: "Guided cursor", category: "PRODUCT UI", description: "Guide the eye through a key workflow.", duration: "2.5s", color: "#7bc6f2", motion: "cursor" },
  { id: "end", name: "Brand end card", category: "CLOSERS", description: "A memorable close with a clear next step.", duration: "3s", color: "#f49bc0", motion: "end" },
];

const starter: Scene[] = [
  { id: "scene-1", title: "Make the first impression", preset: presets[0], seconds: 3 },
  { id: "scene-2", title: "Show the product moment", preset: presets[2], seconds: 4 },
  { id: "scene-3", title: "Give them a reason to care", preset: presets[1], seconds: 3 },
  { id: "scene-4", title: "Close with your brand", preset: presets[7], seconds: 3 },
];

export default function MotionStudioPage() {
  const [selected, setSelected] = useState("hero");
  const [scenes, setScenes] = useState<Scene[]>(starter);
  const [productUrl, setProductUrl] = useState("");
  const [productImage, setProductImage] = useState<string>("");
  const [productImageName, setProductImageName] = useState("");
  const [productVideo, setProductVideo] = useState<string>("");
  const [productVideoName, setProductVideoName] = useState("");
  const [brief, setBrief] = useState("A cinematic launch video for an AI product that helps small teams move faster. Show the real product, one magical moment, and a confident close.");
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState("");
  const [exportSuccess, setExportSuccess] = useState("");
  const [mood, setMood] = useState("Cinematic");

  const duration = useMemo(() => scenes.reduce((sum, scene) => sum + scene.seconds, 0), [scenes]);

  function addPreset(preset: MotionPreset) {
    setScenes(current => [...current, { id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, title: preset.name, preset, seconds: Number.parseFloat(preset.duration) || 2 }]);
    setSelected(preset.id);
    setNotice(`${preset.name} added to your storyboard.`);
  }

  function moveScene(index: number, direction: -1 | 1) {
    setScenes(current => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function draftStoryboard() {
    const text = brief.toLowerCase();
    const chosen = text.includes("before") || text.includes("change")
      ? [presets[0], presets[5], presets[2], presets[7]]
      : text.includes("3d") || text.includes("cinematic")
        ? [presets[0], presets[4], presets[2], presets[7]]
        : [presets[0], presets[1], presets[2], presets[7]];
    setScenes(chosen.map((preset, index) => ({
      id: `draft-${Date.now()}-${index}`,
      title: [ "Open with a hook", "Build the visual moment", "Reveal the product value", "Close with your brand" ][index],
      preset,
      seconds: [3, 2, 4, 3][index],
    })));
    setNotice("Storyboard draft created from your brief. Choose any scene to refine it.");
  }

  async function exportMp4() {
    if (exporting || scenes.length === 0) return;
    setExporting(true);
    setExportProgress(0);
    setExportError("");
    setExportSuccess("");
    try {
      // HD output keeps product UI and small interface text much sharper than 480p.
      // Keep 24 fps to balance smooth motion with browser memory on everyday devices.
      const fps = 24;
      const dimensions = { width: 1280, height: 720 };
      const renderScenes = scenes.map((scene, index) => ({
        id: scene.id,
        kind: index === 0 ? "01 · OPEN" : index === scenes.length - 1 ? "CLOSING" : `SCENE ${String(index + 1).padStart(2, "0")}`,
        title: scene.title.trim() || scene.preset.name,
        subtitle: scene.preset.description,
        duration: Math.max(2, scene.seconds),
        motion: scene.preset.motion === "zoom" ? "Focus zoom" : scene.preset.motion === "orbit" ? "Slow reveal" : scene.preset.motion === "split" ? "Slide & settle" : scene.preset.motion === "cursor" ? "Slide & settle" : scene.preset.motion === "type" ? "Focus zoom" : "Slow reveal",
      }));
      const durationInFrames = renderScenes.reduce((sum, scene) => sum + Math.max(2, Math.round(scene.duration * fps)), 0);
      if (typeof window === "undefined" || !("VideoEncoder" in window)) {
        throw new Error("This browser does not support local MP4 encoding. Try a recent desktop version of Chrome or Edge.");
      }
      setExportProgress(3);
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
      const support = await canRenderMediaOnWeb({ ...dimensions, container: "mp4", videoCodec: "h264", muted: true });
      if (!support.canRender) {
        throw new Error(support.issues.filter(issue => issue.severity === "error").map(issue => issue.message).join(" ") || "This browser cannot render the selected MP4 format.");
      }
      setExportProgress(8);
      const { getBlob } = await renderMediaOnWeb({
        composition: { component: LaunchFilmComposition, durationInFrames, fps, width: dimensions.width, height: dimensions.height, id: "cutlume-motion-studio", defaultProps: { scenes: renderScenes, mood, productImage, productVideo, projectName: productUrl ? (() => { try { return new URL(productUrl).hostname.replace(/^www\\./, ""); } catch { return "Your product"; } })() : "Your product" } },
        inputProps: { scenes: renderScenes, mood, productImage, productVideo, projectName: productUrl ? (() => { try { return new URL(productUrl).hostname.replace(/^www\\./, ""); } catch { return "Your product"; } })() : "Your product" },
        container: "mp4",
        videoCodec: "h264",
        muted: true,
        onProgress: ({ progress }: { progress: number }) => {
          const percent = Math.max(8, Math.min(99, Math.round(progress * 100)));
          setExportProgress(current => current === percent ? current : percent);
        },
      });
      const blob = await getBlob();
      if (!blob || blob.size === 0) throw new Error("The renderer did not produce a video file. Try removing a scene and exporting again.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "cutlume-motion-launch.mp4";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setExportProgress(100);
      setExportSuccess("Your MP4 is ready to play. HD export: 720p at 24 fps. It includes animated scenes but no audio yet.");
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "MP4 export could not finish.");
    } finally {
      setExporting(false);
    }
  }

  const activePreset = presets.find(item => item.id === selected) || presets[0];

  return (
    <main className="motion-page">
      <style jsx>{`
        .motion-page{min-height:100vh;color:#f5f4ff;background:radial-gradient(ellipse at 80% 0%,rgba(103,79,255,.18),transparent 36%),#090a11;font-family:var(--sans,Arial,sans-serif);padding-bottom:70px}
        .m-top{height:72px;max-width:1440px;margin:auto;padding:0 4vw;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff12;gap:18px}
        .m-brand{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:800;letter-spacing:-.7px}.m-mark{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;color:#d2caff;background:linear-gradient(140deg,#7e65ff55,#f18ac522);border:1px solid #9d8bff55}
        .m-nav{display:flex;gap:20px;align-items:center;color:#a9abc0;font-size:12px}.m-nav a:hover{color:white}
        .m-wrap{max-width:1320px;margin:auto;padding:0 4vw}.m-back{display:inline-flex;align-items:center;gap:8px;margin:26px 0 20px;color:#a5a8bf;font-size:12px}
        .m-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:32px;align-items:center;padding:26px 0 38px}.m-eyebrow{font:10px var(--mono,monospace);letter-spacing:1.8px;text-transform:uppercase;color:#b5a8ff;display:flex;align-items:center;gap:8px}.m-hero h1{font-size:clamp(34px,4.5vw,59px);line-height:1.02;letter-spacing:-2.8px;margin:18px 0 15px}.m-grad{background:linear-gradient(95deg,#fff 5%,#bdb0ff 53%,#f6a8d0);color:transparent;background-clip:text}.m-lede{max-width:580px;color:#a2a4bb;line-height:1.8;font-size:14px}.m-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
        .m-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #ffffff1c;border-radius:10px;padding:11px 15px;background:#ffffff08;color:#f6f4ff;font-size:12px;font-weight:650;cursor:pointer;transition:transform .2s,border-color .2s}.m-btn:hover{transform:translateY(-2px);border-color:#a69aff88}.m-btn.primary{background:linear-gradient(110deg,#7965ff,#a17bff);border-color:transparent;box-shadow:0 9px 26px #745bff35}.m-btn:focus-visible,.m-preset:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #c4b8ff;outline-offset:3px}
        .m-demo{border:1px solid #ffffff1b;border-radius:18px;padding:14px;background:linear-gradient(145deg,#171727,#10111a);box-shadow:0 30px 90px #0007;position:relative;overflow:hidden;min-height:290px}.m-demo-top{display:flex;justify-content:space-between;color:#8588a4;font:9px var(--mono,monospace);letter-spacing:1px}.m-screen{margin-top:17px;min-height:220px;border:1px solid #b1a3ff35;border-radius:12px;background:radial-gradient(ellipse at 60% 45%,#6e54ff40,transparent 48%),linear-gradient(130deg,#18192a,#0d0e16);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}.m-screen:before{content:"";position:absolute;inset:0;background-image:linear-gradient(#c2baff0b 1px,transparent 1px),linear-gradient(90deg,#c2baff0b 1px,transparent 1px);background-size:25px 25px;mask-image:linear-gradient(transparent,black,transparent)}.m-orb{position:absolute;width:150px;height:150px;border:1px solid #b2a4ff4a;border-radius:50%;animation:morbit 13s linear infinite}.m-orb:after{content:"";position:absolute;width:10px;height:10px;border-radius:50%;background:#ffc1e0;top:15px;left:22px;box-shadow:0 0 22px #f7a6dc}.m-floating{position:relative;z-index:1;width:75%;border:1px solid #b8b2ff4a;border-radius:11px;padding:19px;background:#151625e8;box-shadow:0 20px 55px #0008;animation:mfloat 4s ease-in-out infinite}.m-mini{font:9px var(--mono,monospace);letter-spacing:1.2px;color:#c2b5ff}.m-big{font-size:clamp(19px,2.4vw,30px);font-weight:800;line-height:1.05;letter-spacing:-1.2px;margin:12px 0}.m-bars{display:flex;gap:6px;margin-top:16px}.m-bars i{height:5px;border-radius:5px;background:#7771e8;flex:1}.m-bars i:nth-child(2){background:#ef9dca}.m-bars i:nth-child(3){background:#80d9c8}.m-current{display:flex;align-items:center;gap:8px;margin-top:13px;color:#b5b1d5;font-size:10px}.m-live{width:6px;height:6px;background:#83e2bd;border-radius:50%;box-shadow:0 0 12px #83e2bd}
        .m-workspace{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(300px,.95fr);gap:16px;align-items:start}.m-panel{border:1px solid #ffffff17;background:linear-gradient(145deg,#141522f2,#0f1019f2);border-radius:15px;overflow:hidden}.m-panel-head{padding:18px 20px;border-bottom:1px solid #ffffff10;display:flex;align-items:center;justify-content:space-between;gap:12px}.m-panel-head h2{font-size:15px;margin:0;letter-spacing:-.3px}.m-panel-head p{font-size:11px;color:#9699b1;margin:5px 0 0}.m-count{font:10px var(--mono,monospace);color:#b6aaff}.m-panel-body{padding:18px 20px}.m-label{display:block;color:#999bb5;font:9px var(--mono,monospace);letter-spacing:1px;margin:16px 0 8px}.m-label:first-child{margin-top:0}.m-input,.m-textarea,.m-select{width:100%;border:1px solid #ffffff19;border-radius:9px;padding:11px 12px;background:#090a12;color:#f4f2ff;font-size:12px;outline:none}.m-textarea{resize:vertical;min-height:92px;line-height:1.6}.m-hint{font-size:10px;color:#777b96;line-height:1.6;margin:7px 0 0}.m-mode{display:flex;gap:6px;padding:4px;background:#090a12;border:1px solid #ffffff12;border-radius:10px}.m-mode button{flex:1;border:0;border-radius:7px;padding:10px 8px;background:transparent;color:#9a9cb4;font-size:11px;cursor:pointer}.m-mode button.active{background:#7b66ff2b;color:#e4ddff;box-shadow:inset 0 0 0 1px #9c89ff4a}.m-preset-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.m-preset{min-width:0;text-align:left;border:1px solid #ffffff16;border-radius:11px;background:#ffffff04;padding:10px;color:#f2f0ff;cursor:grab;transition:transform .2s,border-color .2s,background .2s}.m-preset:hover{transform:translateY(-2px);border-color:#ffffff3a}.m-preset.chosen{border-color:var(--preset);background:linear-gradient(140deg,color-mix(in srgb,var(--preset) 15%,transparent),#ffffff03)}.m-thumb{height:86px;border-radius:7px;position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 50%,color-mix(in srgb,var(--preset) 34%,transparent),transparent 68%),#0a0b13;border:1px solid #ffffff0c;display:flex;align-items:center;justify-content:center}.m-thumb:before{content:"";position:absolute;inset:0;background-image:linear-gradient(#ffffff0b 1px,transparent 1px),linear-gradient(90deg,#ffffff0b 1px,transparent 1px);background-size:15px 15px}.m-thumb-core{z-index:1;width:64%;height:45px;border:1px solid color-mix(in srgb,var(--preset) 65%,white 8%);background:#181928df;border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--preset);box-shadow:0 8px 24px #0006}.m-thumb-core svg{filter:drop-shadow(0 0 7px var(--preset))}.m-preset-name{font-size:11px;font-weight:700;margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:5px}.m-category{font:8px var(--mono,monospace);letter-spacing:.8px;color:var(--preset);margin-top:6px}.m-preset-desc{font-size:10px;line-height:1.55;color:#9396ad;margin-top:6px;min-height:31px}.m-add{font-size:10px;color:#c7c1ff;display:flex;align-items:center;gap:4px;margin-top:9px}
        .m-timeline{display:flex;flex-direction:column;gap:9px}.m-scene{display:grid;grid-template-columns:26px 36px 1fr auto;gap:10px;align-items:center;border:1px solid #ffffff14;border-radius:10px;padding:10px;background:#ffffff04}.m-scene-index{font:9px var(--mono,monospace);color:#7c8099}.m-scene-swatch{width:36px;height:43px;border-radius:7px;display:grid;place-items:center;background:color-mix(in srgb,var(--scene) 20%,#10111b);border:1px solid color-mix(in srgb,var(--scene) 45%,transparent);color:var(--scene)}.m-scene-title{font-size:11px;font-weight:650;overflow-wrap:anywhere}.m-scene-sub{font-size:9px;color:#9295ad;margin-top:5px}.m-scene-controls{display:flex;gap:3px;align-items:center}.m-icon-btn{display:grid;place-items:center;width:26px;height:26px;border:1px solid #ffffff12;background:#ffffff04;border-radius:6px;color:#a8a9bf;cursor:pointer}.m-icon-btn:hover{color:white;border-color:#ffffff38}.m-empty{border:1px dashed #ffffff25;border-radius:10px;padding:22px;text-align:center;color:#999bb2;font-size:11px;line-height:1.7}.m-drop{border:1px dashed #9e8aff50;border-radius:10px;padding:10px;text-align:center;color:#a9a0d9;font-size:10px;margin-top:10px}.m-voice{border:1px solid #ffffff14;border-radius:11px;padding:14px;background:#ffffff04;margin-top:14px}.m-voice-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.m-voice-title{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:700}.m-voice-icon{width:31px;height:31px;display:grid;place-items:center;border-radius:9px;background:#9a7bff20;color:#c6b7ff}.m-toggle{border:1px solid #ffffff1c;background:#272436;border-radius:20px;padding:3px;width:43px;cursor:pointer}.m-toggle span{display:block;width:15px;height:15px;background:#77788e;border-radius:50%;transition:transform .2s}.m-toggle.on{background:#7864f844;border-color:#a996ff80}.m-toggle.on span{transform:translateX(19px);background:#d5caff}.m-wave{height:27px;display:flex;align-items:center;gap:3px;margin:12px 0}.m-wave i{width:3px;border-radius:4px;background:#9c88ff;opacity:.85;animation:mwave .8s ease-in-out infinite alternate}.m-wave i:nth-child(3n){animation-delay:.2s}.m-wave i:nth-child(2n){animation-delay:.4s}.m-note{font-size:10px;line-height:1.6;color:#8286a0;margin:10px 0 0}.m-footer-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.m-notice{border:1px solid #8d7aff48;background:#8c77ff13;color:#d9d0ff;padding:11px 13px;border-radius:9px;font-size:11px;margin-top:14px;line-height:1.5}.m-footnote{color:#757993;font-size:10px;line-height:1.7;margin-top:18px}.m-section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:36px 0 14px}.m-section-title h2{font-size:19px;letter-spacing:-.5px;margin:0}.m-section-title span{font:9px var(--mono,monospace);color:#8589a4;letter-spacing:.7px}
        @keyframes morbit{to{transform:rotate(360deg)}}@keyframes mfloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-7px) rotate(1deg)}}@keyframes mwave{from{height:5px}to{height:24px}}
        @media(max-width:900px){.m-hero{grid-template-columns:1fr;gap:22px}.m-demo{min-height:250px}.m-screen{min-height:190px}.m-workspace{grid-template-columns:1fr}.m-nav{gap:12px}}
        @media(max-width:560px){.m-top{padding:0 18px;height:64px}.m-wrap{padding:0 18px}.m-nav a:not(:first-child){display:none}.m-hero h1{letter-spacing:-1.8px}.m-hero{padding-top:18px}.m-preset-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.m-preset{padding:8px}.m-thumb{height:72px}.m-panel-body{padding:15px}.m-panel-head{padding:15px}.m-scene{grid-template-columns:18px 32px 1fr auto;gap:7px;padding:8px}.m-scene-swatch{width:32px;height:38px}.m-scene-controls .m-icon-btn:last-child{display:none}.m-btn{padding:10px 12px}.m-demo{min-height:230px}.m-screen{min-height:175px}}
        @media(prefers-reduced-motion:reduce){.m-orb,.m-floating,.m-wave i{animation:none!important}.m-btn,.m-preset{transition:none}}
      `}</style>

      <header className="m-top">
        <Link href="/" className="m-brand"><span className="m-mark"><Clapperboard size={18}/></span>cutlume<span style={{color:"#9c8aff"}}>.</span></Link>
        <nav className="m-nav"><Link href="/">Launch studio</Link><Link href="/replay">Demo replay</Link><span style={{color:"#d5caff"}}>Motion library</span></nav>
        <Link href="/" className="m-btn"><ArrowLeft size={14}/> Studio home</Link>
      </header>

      <div className="m-wrap">
        <Link href="/" className="m-back"><ArrowLeft size={13}/> Back to launch studio</Link>
        <section className="m-hero">
          <div>
            <div className="m-eyebrow"><Sparkles size={13}/> THE CREATIVE PLAYGROUND</div>
            <h1>Borrow the feeling.<br/><span className="m-grad">Make it yours.</span></h1>
            <p className="m-lede">Create a short product-launch video in three steps: describe your product, arrange a few scenes, then export an MP4. Start with the example and change anything you like.</p>
            <div className="m-actions">
              <button className="m-btn primary" onClick={draftStoryboard}><WandSparkles size={15}/> Draft a storyboard</button>
              <button className="m-btn" onClick={() => document.getElementById("motion-library")?.scrollIntoView({behavior:"smooth"})}><Layers3 size={15}/> Explore motion library</button>
            </div>
            <p className="m-footnote">Use your own product material to make the story feel like your product, not a generic template.</p>
          </div>
          <div className="m-demo">
            <div className="m-demo-top"><span>LIVE STYLE PREVIEW</span><span>SCENE 0{Math.max(1, presets.findIndex(p => p.id === selected) + 1)}</span></div>
            <div className="m-screen">
              <div className="m-orb" style={{borderColor:activePreset.color+"66"}}/>
              <div className="m-floating" style={{borderColor:activePreset.color+"66"}}>
                <div className="m-mini">A NEW WAY TO BUILD</div>
                <div className="m-big">Make your<br/><span style={{color:activePreset.color}}>next move.</span></div>
                <div className="m-bars"><i/><i/><i/></div>
                <div className="m-current"><span className="m-live"/> {activePreset.name} <span style={{marginLeft:"auto"}}>{activePreset.duration}</span></div>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="How to use Motion Studio" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,margin:"0 0 22px"}}>
          {[["1","Add your product","Upload a real screenshot and briefly explain what your product does."],["2","Shape the story","Use the starter scenes or tap any motion card to add a scene."],["3","Export your MP4","Your screenshot appears in the video. Keep this page open while it renders."]].map(([n,title,description])=><div key={n} style={{padding:"14px 15px",border:"1px solid #ffffff17",borderRadius:12,background:"#ffffff05"}}><div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}><span style={{display:"grid",placeItems:"center",width:25,height:25,borderRadius:8,background:"#8b7bff22",border:"1px solid #a99aff55",color:"#d2caff",fontSize:12,fontWeight:800}}>{n}</span><strong style={{fontSize:12}}>{title}</strong></div><p style={{margin:0,fontSize:11,color:"#a2a4bb",lineHeight:1.6}}>{description}</p></div>)}
        </section>
        <section className="m-workspace">
          <div className="m-panel">
            <div className="m-panel-head"><div><h2><Sparkles size={14} style={{display:"inline",marginRight:7,color:"#b9aaff"}}/>Creative direction</h2><p>Tell ReplayMint what you are trying to make.</p></div><span className="m-count">01 / INPUT</span></div>
            <div className="m-panel-body">
              <div className="m-mode" role="tablist" aria-label="Creation mode">
                <button className={mode === "ai" ? "active" : ""} onClick={() => setMode("ai")} role="tab" aria-selected={mode === "ai"}><Sparkles size={13} style={{display:"inline",marginRight:6}}/>Guided draft</button>
                <button className={mode === "manual" ? "active" : ""} onClick={() => setMode("manual")} role="tab" aria-selected={mode === "manual"}><Layers3 size={13} style={{display:"inline",marginRight:6}}/>Build manually</button>
              </div>
              <label className="m-label" htmlFor="product-url">PRODUCT WEBSITE (OPTIONAL)</label>
              <input className="m-input" id="product-url" type="url" value={productUrl} onChange={e => setProductUrl(e.target.value)} placeholder="https://your-product.com"/>
              <p className="m-hint">Used to label your video. ReplayMint does not import the website automatically yet.</p>
              <label className="m-label" htmlFor="product-image">REAL PRODUCT SCREENSHOT</label>
              <input className="m-input" id="product-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) { setNotice("Please choose a PNG, JPEG, WebP or GIF image."); e.target.value = ""; return; } if (file.size > 8 * 1024 * 1024) { setNotice("Please choose an image smaller than 8 MB so export stays responsive."); e.target.value = ""; return; } if (productImage) URL.revokeObjectURL(productImage); if (productVideo) URL.revokeObjectURL(productVideo); const next = URL.createObjectURL(file); setProductImage(next); setProductImageName(file.name); setProductVideo(""); setProductVideoName(""); setNotice("Screenshot added. It will appear in your exported MP4."); e.target.value = ""; }}/>
              {productImage && <div style={{display:"flex",alignItems:"center",gap:12,marginTop:10,padding:10,border:"1px solid #ffffff1b",borderRadius:10,background:"#ffffff05"}}><img src={productImage} alt="Selected product screenshot" style={{width:88,height:58,objectFit:"cover",borderRadius:6,border:"1px solid #ffffff20"}}/><div style={{minWidth:0,flex:1}}><div style={{fontSize:11,fontWeight:700,overflowWrap:"anywhere"}}>{productImageName}</div><div style={{fontSize:10,color:"#a2a4bb",marginTop:4}}>Included in the MP4 preview and export</div></div><button type="button" className="m-icon-btn" aria-label="Remove screenshot" onClick={() => {URL.revokeObjectURL(productImage);setProductImage("");setProductImageName("");}}> <X size={13}/> </button></div>}
              <label className="m-label" htmlFor="product-video" style={{marginTop:18}}>REPLAYED DEMO VIDEO <span style={{color:"#a2a4bb",fontWeight:400,textTransform:"none"}}>(MP4 or WebM, up to 20 MB)</span></label>
              <input className="m-input" id="product-video" type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (!["video/mp4","video/webm"].includes(file.type) && !/\.(mp4|webm)$/i.test(file.name)) { setNotice("Choose an MP4 or WebM recording exported from Demo Replay."); e.target.value = ""; return; } if (file.size > 20 * 1024 * 1024) { setNotice("Choose a replay clip smaller than 20 MB for browser export."); e.target.value = ""; return; } if (productVideo) URL.revokeObjectURL(productVideo); if (productImage) URL.revokeObjectURL(productImage); const next = URL.createObjectURL(file); setProductVideo(next); setProductVideoName(file.name); setProductImage(""); setProductImageName(""); setNotice("Replay video added. It will play inside your cinematic product scene."); e.target.value = ""; }}/>
              <p className="m-help" style={{fontSize:11,color:"#a2a4bb",lineHeight:1.6,marginTop:6}}>Upload a recording downloaded from Demo Replay to use real product footage instead of a static screenshot. Browser export loops the clip silently inside the product scene.</p>
              {productVideo && <div style={{display:"flex",alignItems:"center",gap:12,marginTop:10,padding:10,border:"1px solid #ffffff1b",borderRadius:10,background:"#ffffff05"}}><div style={{width:88,height:58,display:"grid",placeItems:"center",background:"#171727",borderRadius:6,border:"1px solid #ffffff20"}}><Film size={22}/></div><div style={{minWidth:0,flex:1}}><div style={{fontSize:11,fontWeight:700,overflowWrap:"anywhere"}}>{productVideoName}</div><div style={{fontSize:10,color:"#a2a4bb",marginTop:4}}>Included as moving product footage</div></div><button type="button" className="m-icon-btn" aria-label="Remove replay video" onClick={() => {URL.revokeObjectURL(productVideo);setProductVideo("");setProductVideoName("");}}> <X size={13}/> </button></div>}
              <label className="m-label" htmlFor="creative-brief">YOUR CREATIVE BRIEF</label>
              <textarea className="m-textarea" id="creative-brief" value={brief} onChange={e => setBrief(e.target.value)} placeholder="What does your product do? What should people feel? Which moments matter?"/>
              <div className="m-footer-actions">
                <button className="m-btn primary" onClick={draftStoryboard}><WandSparkles size={14}/>{mode === "ai" ? "Draft from brief" : "Build my first pass"}</button>
                <button className="m-btn" onClick={() => {setBrief("");setNotice("Brief cleared. Add a new creative direction.");}}><X size={14}/> Clear brief</button>
              </div>
            </div>
          </div>

          <div className="m-panel">
            <div className="m-panel-head"><div><h2><Film size={15} style={{display:"inline",marginRight:7,color:"#b9aaff"}}/>Your storyboard</h2><p>Your video outline. Edit the order or remove scenes you do not need.</p></div><span className="m-count">{scenes.length} SCENES</span></div>
            <div className="m-panel-body">
              {scenes.length ? <div className="m-timeline">
                {scenes.map((scene,index) => <div className="m-scene" key={scene.id} draggable onDragStart={() => setDragging(scene.id)} onDragOver={e => e.preventDefault()} onDrop={() => { if (!dragging || dragging === scene.id) return; setScenes(current => {const from=current.findIndex(s=>s.id===dragging);const to=current.findIndex(s=>s.id===scene.id);if(from<0||to<0)return current;const next=[...current];const [item]=next.splice(from,1);next.splice(to,0,item);return next;});setDragging(null);}}>
                  <span className="m-scene-index">{String(index+1).padStart(2,"0")}</span>
                  <span className="m-scene-swatch" style={{"--scene":scene.preset.color} as React.CSSProperties}><GripVertical size={16}/></span>
                  <div><div className="m-scene-title">{scene.title}</div><div className="m-scene-sub">{scene.preset.name} · {scene.seconds}s</div></div>
                  <div className="m-scene-controls"><button className="m-icon-btn" title="Move scene up" aria-label="Move scene up" onClick={() => moveScene(index,-1)}><ArrowUp size={12}/></button><button className="m-icon-btn" title="Move scene down" aria-label="Move scene down" onClick={() => moveScene(index,1)}><ArrowDown size={12}/></button><button className="m-icon-btn" title="Remove scene" aria-label="Remove scene" onClick={() => setScenes(current => current.filter(s=>s.id!==scene.id))}><X size={12}/></button></div>
                </div>)}
              </div> : <div className="m-empty">Your storyboard is empty.<br/>Choose a motion preset below to start building.</div>}
              <div className="m-drop" onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault();if(dragging?.startsWith("preset:")){const p=presets.find(item=>item.id===dragging.slice(7));if(p)addPreset(p);}setDragging(null);}}>Drag a motion preset here to add it to the end of your storyboard</div>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginTop:18,paddingTop:15,borderTop:"1px solid #ffffff12"}}>
                <div><div style={{fontSize:11,fontWeight:700}}>Estimated runtime</div><div style={{fontSize:10,color:"#8c8fa8",marginTop:4}}>{duration}s · {scenes.length} scenes</div></div>
                <div style={{display:"flex",gap:7,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  <button className="m-btn primary" onClick={exportMp4} disabled={exporting || scenes.length === 0}>{exporting ? <><span className="m-live"/> Rendering {exportProgress}%</> : <><Film size={14}/> Export MP4</>}</button>
                </div>
              </div>
              {exporting && <div className="m-notice" role="status" aria-live="polite"><span>Rendering on this device — {exportProgress}%. Keep this tab open; fewer/shorter scenes usually finish sooner.</span><div style={{height:4,background:"#ffffff18",borderRadius:9,overflow:"hidden",marginTop:9}}><div style={{height:"100%",width:`${exportProgress}%`,background:"linear-gradient(90deg,#8b7bff,#f49bc0)",transition:"width .2s"}}/></div></div>}
              {exportError && <div className="m-notice" role="alert" style={{borderColor:"#ff8f9b66",color:"#ffc4cb"}}><strong>Export couldn't finish.</strong><br/>{exportError}</div>}
              {exportSuccess && <div className="m-notice" role="status"><Check size={13} style={{display:"inline",marginRight:7}}/>{exportSuccess}</div>}
              {notice && <div className="m-notice" role="status"><Check size={13} style={{display:"inline",marginRight:7}}/>{notice}</div>}
              <p className="m-footnote">Fast export is 854 × 480 at 24 fps. Add a real product screenshot above to include it in your video. Export currently has no audio; keep the tab open while rendering.</p>
            </div>
          </div>
        </section>

        <div className="m-section-title" id="motion-library"><h2><Layers3 size={18} style={{display:"inline",marginRight:8,color:"#b9aaff"}}/>Motion design library</h2><span>DRAG INTO YOUR STORYBOARD OR TAP TO ADD</span></div>
        <div className="m-preset-grid">
          {presets.map((preset,index) => <button key={preset.id} type="button" draggable className={selected===preset.id ? "m-preset chosen" : "m-preset"} style={{"--preset":preset.color} as React.CSSProperties} onClick={() => {setSelected(preset.id);addPreset(preset);}} onDragStart={() => setDragging("preset:"+preset.id)} onDragEnd={() => setDragging(null)} aria-pressed={selected===preset.id}>
            <div className="m-thumb"><div className="m-thumb-core">{index===0?<Sparkles size={20}/>:index===1?<AudioLines size={20}/>:index===2?<Layers3 size={20}/>:index===3?<Play size={20}/>:index===4?<Film size={20}/>:index===5?<ArrowDown size={20}/>:index===6?<ArrowUp size={20}/>:<Clapperboard size={20}/>}</div></div>
            <div className="m-category">{preset.category}</div>
            <div className="m-preset-name">{preset.name}<Plus size={13}/></div>
            <div className="m-preset-desc">{preset.description}</div>
            <div className="m-add"><span>{preset.duration}</span><span style={{marginLeft:"auto"}}>+ Add scene</span></div>
          </button>)}
        </div>
        <p className="m-footnote">Next up: connect a saved demo-replay workflow to this launch-film editor so founders can update the demo and produce a fresh branded video.</p>
      </div>
    </main>
  );
}

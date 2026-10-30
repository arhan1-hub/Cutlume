"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, Clapperboard, FileVideo2, Play, RotateCcw, ShieldCheck, Volume2 } from "lucide-react";

type ReviewItem = { id: string; title: string; detail: string; approved: boolean };
const initialItems: ReviewItem[] = [
  { id: "visual", title: "Visual layout and controls", detail: "Check moved buttons, missing elements, new screens, and layout changes.", approved: false },
  { id: "result", title: "Product result and behavior", detail: "Confirm the same action still produces the expected result.", approved: false },
  { id: "permissions", title: "Login and permissions", detail: "Check for new login prompts, access requests, or permission restrictions.", approved: false },
  { id: "narration", title: "Narration matches the clip", detail: "Read each line while watching the new recording. Update anything outdated.", approved: false },
  { id: "export", title: "Final export plays correctly", detail: "Play the replacement clip from start to finish before publishing.", approved: false },
];

export default function DemoReviewPage() {
  const [oldUrl, setOldUrl] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [oldName, setOldName] = useState("");
  const [newName, setNewName] = useState("");
  const [narration, setNarration] = useState("");
  const [items, setItems] = useState(initialItems);
  const [notes, setNotes] = useState("");
  const [reviewTitle, setReviewTitle] = useState("Demo refresh review");
  const [visualDiff, setVisualDiff] = useState("");
  const [approvedForPublish, setApprovedForPublish] = useState(false);
  const oldVideoRef = useRef<HTMLVideoElement>(null);
  const newVideoRef = useRef<HTMLVideoElement>(null);
  const oldFrameRef = useRef<HTMLCanvasElement>(null);
  const newFrameRef = useRef<HTMLCanvasElement>(null);
  const diffFrameRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => () => { if (oldUrl) URL.revokeObjectURL(oldUrl); }, [oldUrl]);
  useEffect(() => () => { if (newUrl) URL.revokeObjectURL(newUrl); }, [newUrl]);

  // When arriving from a successful replay job, load that generated clip directly
  // into the local review workspace. The previous/published clip is still user-selected.
  useEffect(() => {
    const jobId = new URLSearchParams(window.location.search).get("jobId");
    if (!jobId || !/^[a-zA-Z0-9_-]{1,128}$/.test(jobId)) return;
    let cancelled = false;
    let objectUrl = "";
    setVisualDiff("Loading the completed replay into this local review session…");
    fetch("/api/replay/" + encodeURIComponent(jobId) + "/video", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Could not load the replay video.");
        }
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setNewUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return objectUrl; });
        setNewName("ReplayMint refreshed demo");
        setApprovedForPublish(false);
        setVisualDiff("New replay loaded. Choose the previous published clip, then compare and review before publishing.");
      })
      .catch((error) => {
        if (!cancelled) setVisualDiff(error instanceof Error ? error.message : "Could not load the replay video.");
      });
    return () => {
      cancelled = true;
      // The component's URL cleanup effect owns URLs once state has adopted them.
      if (objectUrl && cancelled && !newUrl) URL.revokeObjectURL(objectUrl);
    };
  // This runs only when the review page mounts; changing the selected clip does not refetch the job.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approvedCount = items.filter((item) => item.approved).length;
  const canApprove = approvedCount === items.length && Boolean(oldUrl) && Boolean(newUrl) && narration.trim().length > 0;
  const status = approvedForPublish
    ? "Approved for manual publishing"
    : canApprove
      ? "Ready for your final decision"
      : "Review required";
  const progress = Math.round((approvedCount / items.length) * 100);

  function chooseFile(which: "old" | "new", file?: File) {
    if (!file) return;
    if (!file.type.startsWith("video/")) return;
    const url = URL.createObjectURL(file);
    setApprovedForPublish(false);
    if (which === "old") { setOldUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return url; }); setOldName(file.name); }
    else { setNewUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return url; }); setNewName(file.name); }
  }

  function compareCurrentFrames() {
    const oldVideo = oldVideoRef.current;
    const newVideo = newVideoRef.current;
    const oldCanvas = oldFrameRef.current;
    const newCanvas = newFrameRef.current;
    const diffCanvas = diffFrameRef.current;
    if (!oldVideo || !newVideo || !oldCanvas || !newCanvas || !diffCanvas || oldVideo.readyState < 2 || newVideo.readyState < 2) {
      setVisualDiff("Choose both clips and play or scrub each one until a frame is ready, then compare again.");
      return;
    }
    const width = 480;
    const height = 270;
    for (const canvas of [oldCanvas, newCanvas, diffCanvas]) { canvas.width = width; canvas.height = height; }
    const oldContext = oldCanvas.getContext("2d", { willReadFrequently: true });
    const newContext = newCanvas.getContext("2d", { willReadFrequently: true });
    const diffContext = diffCanvas.getContext("2d");
    if (!oldContext || !newContext || !diffContext) { setVisualDiff("This browser could not prepare the frame comparison."); return; }
    oldContext.drawImage(oldVideo, 0, 0, width, height);
    newContext.drawImage(newVideo, 0, 0, width, height);
    const before = oldContext.getImageData(0, 0, width, height);
    const after = newContext.getImageData(0, 0, width, height);
    const output = diffContext.createImageData(width, height);
    let changed = 0;
    for (let i = 0; i < before.data.length; i += 4) {
      const delta = (Math.abs(before.data[i] - after.data[i]) + Math.abs(before.data[i + 1] - after.data[i + 1]) + Math.abs(before.data[i + 2] - after.data[i + 2])) / 3;
      if (delta > 28) { changed++; output.data[i] = 255; output.data[i + 1] = 91; output.data[i + 2] = 74; output.data[i + 3] = 220; }
      else { const gray = Math.round((before.data[i] + before.data[i + 1] + before.data[i + 2]) / 3 * 0.22); output.data[i] = gray; output.data[i + 1] = gray; output.data[i + 2] = gray; output.data[i + 3] = 255; }
    }
    diffContext.putImageData(output, 0, 0);
    const percent = changed / (width * height) * 100;
    setVisualDiff(`${percent.toFixed(1)}% of pixels differ between the frames currently shown. This is a visual signal only—not proof that product behavior, permissions, or narration match.`);
  }

  function toggleItem(id: string) {
    setApprovedForPublish(false);
    setItems((current) => current.map((item) => item.id === id ? { ...item, approved: !item.approved } : item));
  }

  function downloadReport() {
    const report = {
      title: reviewTitle,
      createdAt: new Date().toISOString(),
      status: approvedForPublish ? "approved_for_manual_publishing" : canApprove ? "review_complete_pending_approval" : "review_incomplete",
      clips: { previous: oldName || null, replacement: newName || null },
      narration,
      checks: items.map(({ title, detail, approved }) => ({ title, detail, approved })),
      notes,
      limitations: "This report records manual review only. ReplayMint has not automatically verified semantic equivalence between clips or narration.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "replaymint-review-report.json"; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="app-root replay-root review-root">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar replay-topbar">
        <Link className="brand replay-brand" href="/" aria-label="ReplayMint home"><span className="brand-mark"><Clapperboard size={19} /></span><span>replaymint<span className="brand-period">.</span></span></Link>
        <nav className="top-nav replay-nav" aria-label="Main navigation"><Link href="/">Launch studio</Link><Link href="/replay">Demo replay</Link><span className="replay-nav-active">Review clips</span><Link href="/pricing">Pilot pricing</Link></nav>
      </header>
      <div className="review-shell">
        <Link className="review-back" href="/replay"><ArrowLeft size={15} /> Back to demo replay</Link>
        <section className="review-intro">
          <p className="eyebrow"><ShieldCheck size={14} /> PRE-PUBLISH QUALITY CHECK</p>
          <h1>Same story. <span>Still true?</span></h1>
          <p>Compare the old and replacement clips, check your narration against the new flow, and record the review before publishing. Your clips stay in this browser session; they are not uploaded by this page.</p>
        </section>
        <section className="review-title-card">
          <label htmlFor="review-title">Review name</label>
          <input id="review-title" value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} maxLength={100} />
          <div className="review-local-note"><ShieldCheck size={15} /> Local review · video files stay on your device</div>
        </section>
        <section className="review-clips">
          <article className="review-clip-card">
            <div className="review-clip-head"><span className="review-clip-number">01</span><div><h2>Previous clip</h2><p>The version you already published</p></div></div>
            <label className="review-upload" htmlFor="old-clip"><FileVideo2 size={21} /><span><strong>{oldName || "Choose previous video"}</strong><small>MP4, WebM, or another browser-playable video</small></span><span className="review-upload-action">Browse</span></label>
            <input className="review-file-input" id="old-clip" type="file" accept="video/*" onChange={(e) => chooseFile("old", e.target.files?.[0])} />
            {oldUrl ? <video ref={oldVideoRef} className="review-video" src={oldUrl} controls playsInline preload="metadata" /> : <div className="review-video-empty"><Play size={25} /><span>Previous clip preview</span></div>}
          </article>
          <article className="review-clip-card review-clip-new">
            <div className="review-clip-head"><span className="review-clip-number">02</span><div><h2>Replacement clip</h2><p>The refreshed recording to publish</p></div></div>
            <label className="review-upload" htmlFor="new-clip"><FileVideo2 size={21} /><span><strong>{newName || "Choose replacement video"}</strong><small>Use the new export you want to publish</small></span><span className="review-upload-action">Browse</span></label>
            <input className="review-file-input" id="new-clip" type="file" accept="video/*" onChange={(e) => chooseFile("new", e.target.files?.[0])} />
            {newUrl ? <video ref={newVideoRef} className="review-video" src={newUrl} controls playsInline preload="metadata" /> : <div className="review-video-empty"><Play size={25} /><span>Replacement clip preview</span></div>}
          </article>
        </section>
        <section className="review-section review-visual-diff">
          <div className="review-section-heading"><div><p className="eyebrow">FRAME COMPARISON</p><h2>Spot visual changes</h2></div><Clapperboard size={21} /></div>
          <p className="review-help">Pause or scrub both videos to the moments you want to compare, then capture the current frames. Red areas mark pixel differences. Animated content, different scroll positions, and timing can create differences even when nothing is broken.</p>
          <button type="button" className="button button-secondary" onClick={compareCurrentFrames}>Compare current frames</button>
          {visualDiff && <p className="review-diff-result" role="status">{visualDiff}</p>}
          <div className="review-diff-grid"><div><span>Previous frame</span><canvas ref={oldFrameRef} aria-label="Previous clip frame" /></div><div><span>Replacement frame</span><canvas ref={newFrameRef} aria-label="Replacement clip frame" /></div><div><span>Difference overlay</span><canvas ref={diffFrameRef} aria-label="Pixel difference overlay" /></div></div>
        </section>
        <section className="review-section">
          <div className="review-section-heading"><div><p className="eyebrow">SCRIPT CHECK</p><h2>Read the narration with the new clip</h2></div><Volume2 size={21} /></div>
          <p className="review-help">Paste the narration used in the video. Play the replacement clip and confirm each line still describes what the viewer sees and what the product actually does.</p>
          <textarea value={narration} onChange={(e) => { setNarration(e.target.value); setApprovedForPublish(false); }} placeholder="Example: Enter a question, review the generated answer, then open the upgrade screen…" rows={4} />
        </section>
        <section className="review-section">
          <div className="review-section-heading"><div><p className="eyebrow">HUMAN VERIFICATION</p><h2>Before you publish</h2></div><span className="review-count">{approvedCount}/{items.length} checked</span></div>
          <div className="review-progress"><span style={{ width: progress + "%" }} /></div>
          <div className="review-checks">{items.map((item) => <label className={"review-check " + (item.approved ? "is-approved" : "")} key={item.id}><input type="checkbox" checked={item.approved} onChange={() => toggleItem(item.id)} /><span className="review-check-icon">{item.approved ? <CheckCircle2 size={19} /> : <CircleAlert size={19} />}</span><span className="review-check-copy"><strong>{item.title}</strong><small>{item.detail}</small></span></label>)}</div>
          <label className="review-notes-label" htmlFor="review-notes">Changes, concerns, or follow-up notes</label>
          <textarea id="review-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note a changed result, a permission prompt, or narration to update…" rows={3} />
        </section>
        <section className={"review-status " + (approvedForPublish ? "review-status-ready" : "")}>
          <div>
            <p className="eyebrow">REVIEW STATUS</p>
            <h2>{status}</h2>
            <p>{approvedForPublish
              ? "You approved this replacement for manual publishing. ReplayMint has not replaced or published anything; upload the clip yourself only after checking the destination."
              : canApprove
                ? "Your checklist is complete. Explicitly approve this replacement before treating it as ready. Nothing is automatically overwritten or published."
                : "Choose both clips, add the narration, and complete every check. Any item that needs attention should stay unchecked until fixed."}</p>
          </div>
          <div className="review-status-actions">
            <button type="button" className="button button-primary button-large" onClick={() => setApprovedForPublish(true)} disabled={!canApprove || approvedForPublish}>Approve replacement for manual publishing</button>
            <button type="button" className="button button-secondary" onClick={downloadReport} disabled={!oldUrl || !newUrl}>Export review report</button>
          </div>
        </section>
        <p className="review-footnote"><RotateCcw size={14} /> Safety rule: this is a human approval gate, not automatic replacement. The current prototype does not detect loading spinners or half-rendered states automatically, and it does not publish to your app. Any change to the clips, narration, or checklist resets approval.</p>
      </div>
    </main>
  );
}

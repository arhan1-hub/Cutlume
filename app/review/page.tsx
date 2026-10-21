"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => () => { if (oldUrl) URL.revokeObjectURL(oldUrl); if (newUrl) URL.revokeObjectURL(newUrl); }, [oldUrl, newUrl]);

  const approvedCount = items.filter((item) => item.approved).length;
  const canApprove = approvedCount === items.length && Boolean(oldUrl) && Boolean(newUrl) && narration.trim().length > 0;
  const status = canApprove ? "Ready for your final decision" : "Review required";
  const progress = Math.round((approvedCount / items.length) * 100);

  function chooseFile(which: "old" | "new", file?: File) {
    if (!file) return;
    if (!file.type.startsWith("video/")) return;
    const url = URL.createObjectURL(file);
    if (which === "old") { setOldUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return url; }); setOldName(file.name); }
    else { setNewUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return url; }); setNewName(file.name); }
  }

  function toggleItem(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, approved: !item.approved } : item));
  }

  function downloadReport() {
    const report = {
      title: reviewTitle,
      createdAt: new Date().toISOString(),
      status: canApprove ? "reviewed_by_user" : "review_incomplete",
      clips: { previous: oldName || null, replacement: newName || null },
      narration,
      checks: items.map(({ title, detail, approved }) => ({ title, detail, approved })),
      notes,
      limitations: "This report records manual review only. Cutlume has not automatically verified semantic equivalence between clips or narration.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "cutlume-review-report.json"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-root replay-root review-root">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar replay-topbar">
        <Link className="brand replay-brand" href="/" aria-label="Cutlume home"><span className="brand-mark"><Clapperboard size={19} /></span><span>cutlume<span className="brand-period">.</span></span></Link>
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
            {oldUrl ? <video className="review-video" src={oldUrl} controls playsInline preload="metadata" /> : <div className="review-video-empty"><Play size={25} /><span>Previous clip preview</span></div>}
          </article>
          <article className="review-clip-card review-clip-new">
            <div className="review-clip-head"><span className="review-clip-number">02</span><div><h2>Replacement clip</h2><p>The refreshed recording to publish</p></div></div>
            <label className="review-upload" htmlFor="new-clip"><FileVideo2 size={21} /><span><strong>{newName || "Choose replacement video"}</strong><small>Use the new export you want to publish</small></span><span className="review-upload-action">Browse</span></label>
            <input className="review-file-input" id="new-clip" type="file" accept="video/*" onChange={(e) => chooseFile("new", e.target.files?.[0])} />
            {newUrl ? <video className="review-video" src={newUrl} controls playsInline preload="metadata" /> : <div className="review-video-empty"><Play size={25} /><span>Replacement clip preview</span></div>}
          </article>
        </section>
        <section className="review-section">
          <div className="review-section-heading"><div><p className="eyebrow">SCRIPT CHECK</p><h2>Read the narration with the new clip</h2></div><Volume2 size={21} /></div>
          <p className="review-help">Paste the narration used in the video. Play the replacement clip and confirm each line still describes what the viewer sees and what the product actually does.</p>
          <textarea value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Example: Enter a question, review the generated answer, then open the upgrade screen…" rows={4} />
        </section>
        <section className="review-section">
          <div className="review-section-heading"><div><p className="eyebrow">HUMAN VERIFICATION</p><h2>Before you publish</h2></div><span className="review-count">{approvedCount}/{items.length} checked</span></div>
          <div className="review-progress"><span style={{ width: progress + "%" }} /></div>
          <div className="review-checks">{items.map((item) => <label className={"review-check " + (item.approved ? "is-approved" : "")} key={item.id}><input type="checkbox" checked={item.approved} onChange={() => toggleItem(item.id)} /><span className="review-check-icon">{item.approved ? <CheckCircle2 size={19} /> : <CircleAlert size={19} />}</span><span className="review-check-copy"><strong>{item.title}</strong><small>{item.detail}</small></span></label>)}</div>
          <label className="review-notes-label" htmlFor="review-notes">Changes, concerns, or follow-up notes</label>
          <textarea id="review-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note a changed result, a permission prompt, or narration to update…" rows={3} />
        </section>
        <section className={"review-status " + (canApprove ? "review-status-ready" : "")}>
          <div><p className="eyebrow">REVIEW STATUS</p><h2>{status}</h2><p>{canApprove ? "All manual checks are marked complete. This is your review record, not an automated guarantee that the clips are equivalent." : "Choose both clips, add the narration, and complete every check. Any item that needs attention should stay unchecked until fixed."}</p></div>
          <button className="button button-primary button-large" onClick={downloadReport} disabled={!oldUrl || !newUrl}>Export review report</button>
        </section>
        <p className="review-footnote"><RotateCcw size={14} /> This tool records your review and creates a JSON report. It does not yet automatically detect semantic differences, transcribe audio, or verify permission changes.</p>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, LockKeyhole, ShieldCheck } from "lucide-react";

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function beginCheckout() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.url !== "string") throw new Error(payload.error || "Checkout is not available yet.");
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start checkout.");
      setLoading(false);
    }
  }
  const benefits = [
    "Help configure one demo workflow for your app",
    "Review replay failures and compatibility together",
    "Test captions, highlights, and branded video output",
    "Give direct feedback that shapes the roadmap",
  ];
  return (
    <main className="pricing-root">
      <div className="pricing-shell">
        <Link href="/" className="pricing-back"><ArrowLeft size={16} /> Back to Cutlume</Link>
        <header className="pricing-heading">
          <p className="pricing-eyebrow">Founding pilot</p>
          <h1>Keep your demo <span>in sync.</span></h1>
          <p>Work with us to test repeatable product-demo workflows, spot failed steps, and prepare a fresh video for review. Built for early SaaS founders who want to help shape the product.</p>
        </header>
        <section className="pricing-card">
          <div className="pricing-card-top"><div><h2>Founding pilot access</h2><p>A one-time pilot purchase. The final price and terms will be shown by secure checkout before you pay.</p></div><span className="pricing-badge">Limited pilot</span></div>
          <div className="pricing-rule" />
          <ul>{benefits.map((item) => <li key={item}><Check size={17} /> <span>{item}</span></li>)}</ul>
          <button className="button button-primary button-large full-width pricing-checkout" onClick={beginCheckout} disabled={loading}>{loading ? "Opening secure checkout…" : <>Continue to secure checkout <ArrowRight size={17} /></>}</button>
          {error && <p role="alert" className="pricing-error">{error}</p>}
          <div className="pricing-trust"><span><LockKeyhole size={13} /> Payment details handled by Stripe</span><span><ShieldCheck size={13} /> No charge until checkout confirms</span></div>
        </section>
        <p className="pricing-disclaimer">Cutlume is an early-stage product. App compatibility varies and must be checked before purchase; this pilot is a guided test, not a promise that every third-party app can be replayed automatically.</p>
      </div>
    </main>
  );
}

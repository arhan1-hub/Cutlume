"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, LockKeyhole, ShieldCheck } from "lucide-react";

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function beginCheckout() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.url !== "string") {
        throw new Error(payload.error || "Checkout is not available yet.");
      }
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start checkout.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#090b12] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/65 transition hover:text-white"><ArrowLeft size={16} /> Back to Cutlume</Link>
        <div className="mx-auto mt-16 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">Founding pilot</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Keep your demo in sync.</h1>
          <p className="mt-5 text-base leading-7 text-white/65 sm:text-lg">Work with us to test repeatable product-demo workflows, spot failed steps, and prepare a fresh video for review. Built for early SaaS founders who want to help shape the product.</p>
        </div>
        <section className="mx-auto mt-12 max-w-xl rounded-3xl border border-white/12 bg-white/[0.04] p-7 shadow-2xl shadow-black/20 sm:p-9">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xl font-semibold">Founding pilot access</p><p className="mt-2 text-sm leading-6 text-white/60">A one-time pilot purchase. The exact price and terms are shown by the secure checkout page before you pay.</p></div>
            <span className="rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1 text-xs font-medium text-orange-200">Limited pilot</span>
          </div>
          <div className="my-7 h-px bg-white/10" />
          <ul className="space-y-3 text-sm text-white/80">
            {[
              "Help configure one demo workflow for your app",
              "Review replay failures and compatibility together",
              "Test captions, highlights, and branded video output",
              "Give direct feedback that shapes the roadmap",
            ].map((item) => <li key={item} className="flex items-start gap-3"><Check className="mt-0.5 shrink-0 text-orange-300" size={17} />{item}</li>)}
          </ul>
          <button onClick={beginCheckout} disabled={loading} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-400 px-5 py-3.5 font-semibold text-black transition hover:bg-orange-300 disabled:cursor-wait disabled:opacity-60">
            {loading ? "Opening secure checkout…" : "Continue to secure checkout"} {!loading && <ArrowRight size={17} />}
          </button>
          {error && <p role="alert" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">{error}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/45"><span className="inline-flex items-center gap-1.5"><LockKeyhole size={13} /> Payment details handled by Stripe</span><span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> No charge until checkout confirms</span></div>
        </section>
        <p className="mx-auto mt-6 max-w-xl text-center text-xs leading-5 text-white/40">Pilot access is early-stage and compatibility varies by app. The checkout page displays the final amount and payment terms before you confirm. Purchase does not guarantee every third-party app can be replayed automatically.</p>
      </div>
    </main>
  );
}

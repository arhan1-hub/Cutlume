import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default function CheckoutSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090b12] px-5 py-12 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center sm:p-12">
        <CheckCircle2 className="mx-auto text-emerald-300" size={42} />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">Cutlume pilot</p>
        <h1 className="mt-3 text-3xl font-semibold">Thanks for supporting the pilot.</h1>
        <p className="mt-4 leading-7 text-white/65">This page alone does not verify payment or activate access. We’ll need a verified payment event and a fulfillment process before the pilot can be considered fully automated.</p>
        <Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-orange-400 px-5 py-3 font-semibold text-black transition hover:bg-orange-300">Return to Cutlume <ArrowRight size={16} /></Link>
      </section>
    </main>
  );
}

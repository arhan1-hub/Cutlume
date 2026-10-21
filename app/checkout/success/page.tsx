import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default function CheckoutSuccessPage() {
  return (
    <main className="pricing-root">
      <section className="checkout-result">
        <CheckCircle2 className="checkout-result-icon" size={42} />
        <p className="pricing-eyebrow">Cutlume pilot</p>
        <h1>Thanks for supporting the pilot.</h1>
        <p>This return page does not independently verify payment or activate access. Cutlume still needs verified payment-event handling and a fulfillment process before purchases can be considered fully automated.</p>
        <Link href="/" className="button button-primary button-large">Return to Cutlume <ArrowRight size={16} /></Link>
      </section>
    </main>
  );
}

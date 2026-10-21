import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!secretKey || !priceId || !appUrl) {
    return NextResponse.json(
      { error: "Checkout is not enabled yet. The payment account and price must be configured first." },
      { status: 503 },
    );
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(appUrl);
    if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost") throw new Error("HTTPS required");
  } catch {
    return NextResponse.json({ error: "The app URL is not configured safely." }, { status: 500 });
  }

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", new URL("/checkout/success?session_id={CHECKOUT_SESSION_ID}", baseUrl).toString());
  form.set("cancel_url", new URL("/pricing?checkout=cancelled", baseUrl).toString());
  form.set("billing_address_collection", "auto");
  form.set("submit_type", "pay");
  form.set("allow_promotion_codes", "false");
  form.set("metadata[product]", "cutlume_founder_pilot");

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const session = await response.json().catch(() => ({}));
    if (!response.ok || typeof session.url !== "string") {
      return NextResponse.json(
        { error: "Checkout could not be created. Please try again later." },
        { status: 502 },
      );
    }
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The payment provider could not be reached. No payment was taken." }, { status: 502 });
  }
}

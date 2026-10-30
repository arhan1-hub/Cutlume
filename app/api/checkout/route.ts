import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable(message: string, code: string, status = 503) {
  return NextResponse.json({ error: message, code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  // Keep checkout off until the provider account, price, webhook, and pilot fulfillment
  // have been verified. This flag must only be enabled after the checklist in docs/payments.md.
  if (process.env.LEMONSQUEEZY_CHECKOUT_ENABLED !== "true") {
    return unavailable("Founding pilot checkout is not open yet. Request a guided pilot while we verify payment and delivery.", "PILOT_CHECKOUT_NOT_READY");
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!apiKey || !storeId || !variantId || !siteUrl) {
    return unavailable("Checkout is not configured yet. Please request a guided pilot.", "CHECKOUT_CONFIGURATION_MISSING");
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const requestOrigin = new URL(origin).origin;
      const expectedOrigin = new URL(siteUrl).origin;
      if (requestOrigin !== expectedOrigin) return unavailable("Invalid checkout origin.", "INVALID_ORIGIN", 403);
    } catch {
      return unavailable("Checkout configuration is invalid.", "INVALID_CONFIGURATION", 500);
    }
  }

  try {
    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            product_options: {
              name: "ReplayMint Founding Pilot",
              description: "A guided pilot to validate one product-demo workflow. Compatibility and delivery are confirmed with you before work begins.",
              redirect_url: new URL("/checkout/success", siteUrl).toString(),
              receipt_button_text: "Return to ReplayMint",
              receipt_link_url: siteUrl,
              receipt_thank_you_note: "Thanks for supporting the ReplayMint founding pilot. We will follow up with next steps.",
            },
            checkout_options: { embed: false, media: false, logo: true },
            checkout_data: { custom: { offer: "founding_pilot", source: "replaymint_preview" } },
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
          relationships: {
            store: { data: { type: "stores", id: storeId } },
            variant: { data: { type: "variants", id: variantId } },
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    const payload = await response.json().catch(() => ({}));
    const url = payload?.data?.attributes?.url;
    if (!response.ok || typeof url !== "string") {
      // Do not return provider response details or credentials to the browser.
      console.error("Lemon Squeezy checkout creation failed", { status: response.status });
      return unavailable("Secure checkout could not be created. Please request a guided pilot instead.", "CHECKOUT_CREATION_FAILED", 502);
    }
    const checkoutUrl = new URL(url);
    if (checkoutUrl.protocol !== "https:" || !checkoutUrl.hostname.endsWith("lemonsqueezy.com")) {
      return unavailable("Payment provider returned an invalid checkout URL.", "INVALID_CHECKOUT_URL", 502);
    }
    return NextResponse.json({ url: checkoutUrl.toString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return unavailable("Secure checkout is temporarily unavailable. Please request a guided pilot instead.", "CHECKOUT_UNAVAILABLE", 502);
  }
}

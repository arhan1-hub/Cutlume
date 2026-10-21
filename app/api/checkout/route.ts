import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Checkout remains intentionally disabled until signed payment-event verification
// and a reliable pilot fulfillment process are deployed and tested.
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: "The founding pilot is not accepting payments yet. Contact us to discuss a guided pilot while we finish verification.",
      code: "PILOT_CHECKOUT_NOT_READY",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

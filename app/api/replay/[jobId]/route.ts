import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const workerUrl = process.env.CUTLUME_REPLAY_WORKER_URL;
  const workerToken = process.env.CUTLUME_REPLAY_WORKER_TOKEN;
  if (!workerUrl || !workerToken) return NextResponse.json({ error: "Replay service is not connected yet." }, { status: 503 });
  const { jobId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(jobId)) return NextResponse.json({ error: "Invalid replay job ID." }, { status: 400 });
  try {
    const endpoint = new URL("/jobs/" + encodeURIComponent(jobId), workerUrl);
    const upstream = await fetch(endpoint, {
      headers: { authorization: "Bearer " + workerToken },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return NextResponse.json({ error: "Could not retrieve replay job status." }, { status: upstream.status === 404 ? 404 : 502 });
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not reach the replay worker." }, { status: 502 }); }
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const workerUrl = process.env.CUTLUME_REPLAY_WORKER_URL;
  const workerToken = process.env.CUTLUME_REPLAY_WORKER_TOKEN;
  if (!workerUrl || !workerToken) {
    return NextResponse.json({ error: "Replay service is not connected yet." }, { status: 503 });
  }

  const { jobId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(jobId)) {
    return NextResponse.json({ error: "Invalid replay job ID." }, { status: 400 });
  }

  try {
    const endpoint = new URL("/jobs/" + encodeURIComponent(jobId) + "/video", workerUrl);
    const upstream = await fetch(endpoint, {
      headers: { authorization: "Bearer " + workerToken },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => ({}));
      const status = upstream.status === 409 ? 409 : upstream.status === 404 ? 404 : upstream.status === 410 ? 410 : 502;
      return NextResponse.json(
        { error: typeof payload?.error === "string" ? payload.error : "Video download failed at the replay worker." },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!upstream.body) {
      return NextResponse.json({ error: "Replay worker returned an empty video response." }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "video/mp4";
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": 'attachment; filename="replaymint-demo.' + (contentType.includes("mp4") ? "mp4" : "webm") + '"',
      "Cache-Control": "private, no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    });
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    // Stream the worker response through without buffering the whole video in server memory.
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    const detail = error instanceof Error ? error.name : "unknown";
    return NextResponse.json(
      { error: detail === "TimeoutError" ? "The video download timed out. Retry once on a stable connection." : "The replay worker connection closed before the video could be downloaded. Retry once; if it repeats, inspect the staging worker logs." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { processNextUnits } from "@/lib/demo-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One step processes a whole prompt's surfaces in parallel; keep the ceiling
// high. On Vercel Hobby the effective max is 60s; Pro allows up to 300.
export const maxDuration = 60;

/** Processes the next batch of the run and returns progress. Called repeatedly by the client. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const runId = String(body?.runId ?? "").trim();
  if (!runId) return NextResponse.json({ error: "missing_run" }, { status: 400 });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const status = await processNextUnits(runId);
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: "step_failed", detail: String((e as Error)?.message ?? e).slice(0, 300) },
      { status: 500 }
    );
  }
}

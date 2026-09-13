import { NextResponse, type NextRequest } from "next/server";
import { getRunStatus } from "@/lib/demo-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId")?.trim();
  if (!runId) return NextResponse.json({ error: "missing_run" }, { status: 400 });
  // A malformed id can't match a uuid column — treat as not found, never a 500.
  if (!UUID.test(runId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const status = await getRunStatus(runId);
  if (!status) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(status);
}

import { NextResponse, type NextRequest } from "next/server";
import { getRunStatus } from "@/lib/demo-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId")?.trim();
  if (!runId) return NextResponse.json({ error: "missing_run" }, { status: 400 });
  const status = await getRunStatus(runId);
  if (!status) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(status);
}

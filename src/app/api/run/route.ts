import { NextResponse, type NextRequest } from "next/server";
import { createRun } from "@/lib/demo-runner";
import { countryByIso, DEFAULT_ISO } from "@/lib/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates a demo run for a valid, unused invite token. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const token = String(body?.token ?? "").trim();
  const website = String(body?.website ?? "").trim();
  const own_brand = String(body?.own_brand ?? "").trim();
  const competitors = Array.isArray(body?.competitors)
    ? (body.competitors as unknown[]).map((c) => String(c).trim()).filter(Boolean).slice(0, 5)
    : [];
  const prompts = Array.isArray(body?.prompts)
    ? (body.prompts as unknown[]).map((p) => String(p).trim()).filter(Boolean).slice(0, 3)
    : [];

  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!website || !own_brand) return NextResponse.json({ error: "missing_brand" }, { status: 400 });
  if (!prompts.length) return NextResponse.json({ error: "no_prompts" }, { status: 400 });

  const country = countryByIso(String(body?.country ?? "").trim()) ?? countryByIso(DEFAULT_ISO)!;

  const result = await createRun(token, {
    website,
    own_brand,
    competitors,
    prompts,
    location: country.location,
    country_iso: country.iso,
  });
  if ("error" in result) {
    const status = result.error === "daily_cap" ? 429 : result.error === "invalid_invite" ? 404 : 409;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}

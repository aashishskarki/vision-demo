import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { sendInviteEmail, notifyNewInvite } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The invite form lives on aashishkarki.com (a different origin), so this route
// must answer CORS preflight and echo the allowed origin.
function cors() {
  return {
    "Access-Control-Allow-Origin": process.env.INVITE_ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function POST(request: NextRequest) {
  const h = cors();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400, headers: h });
  }

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const company = String(body?.company ?? "").trim();
  if (!name || !company || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400, headers: h });
  }

  const sql = getSql();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const cap = Number(process.env.INVITE_IP_DAILY_CAP ?? 5);
  if (ip) {
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from invites
      where ip = ${ip} and created_at >= date_trunc('day', now())`;
    if (Number(n) >= cap) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: h });
    }
  }

  const token = randomBytes(24).toString("base64url");
  await sql`
    insert into invites (token, name, email, company, ip)
    values (${token}, ${name}, ${email}, ${company}, ${ip})`;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const link = `${base}/run/${token}`;
  try {
    await sendInviteEmail(email, name, link);
    await notifyNewInvite({ name, email, company });
  } catch (e) {
    return NextResponse.json(
      { error: "email_failed", detail: String((e as Error)?.message ?? e).slice(0, 200) },
      { status: 502, headers: h }
    );
  }

  return NextResponse.json({ ok: true }, { headers: h });
}

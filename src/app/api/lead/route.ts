import { NextResponse, type NextRequest } from "next/server";
import { getSql } from "@/lib/db";
import { sendLeadEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lead capture from the results-page CTA — the "get in touch" popup (phone) and
 * (optionally) a WhatsApp click. Stores the lead and emails Aashish with the
 * subject "Requested for Setup (Tried Demo)".
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const source = String(body?.source ?? "form").trim();
  const name = body?.name ? String(body.name).trim() : null;
  const email = body?.email ? String(body.email).trim() : null;
  const company = body?.company ? String(body.company).trim() : null;
  const phone = body?.phone ? String(body.phone).trim() : null;
  const runId = body?.runId ? String(body.runId).trim() : null;

  if (source === "form" && !phone) {
    return NextResponse.json({ error: "missing_phone" }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    insert into leads (name, email, company, phone, source, run_id)
    values (${name}, ${email}, ${company}, ${phone}, ${source}, ${runId})`;

  try {
    await sendLeadEmail({ name: name ?? undefined, email: email ?? undefined, company: company ?? undefined, phone: phone ?? undefined, source });
  } catch (e) {
    // The lead is saved even if the email fails; report so the UI can still thank them.
    return NextResponse.json(
      { ok: true, emailed: false, detail: String((e as Error)?.message ?? e).slice(0, 200) },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, emailed: true });
}
